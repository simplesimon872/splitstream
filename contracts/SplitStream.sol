// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title SplitStream
 * @notice Splits Arc USDC among a fixed, ordered list of recipients, pushing
 * payouts immediately and crediting failed payouts for recipient-only claims.
 * @dev Uses only the USDC ERC-20 interface at Arc's predeploy address.
 * All amounts use its 6-decimal base units: 1 USDC = 1e6 units.
 * Arc's 18-decimal native gas view (msg.value) is not used by this contract.
 * Share calculations are decimal-agnostic. The last recipient gets all dust.
 * There is no owner, configuration setter, upgrade mechanism, or rescue function.
 * Each distribution pushes or credits exactly the amount pulled. Only the credited
 * recipient can withdraw; funds for a permanently blocklisted recipient may stay
 * stuck forever. Unsolicited token transfers are not distributable or recoverable.
 * The USDC balance of this contract must remain at least totalClaimable.
 */
contract SplitStream is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Arc USDC ERC-20 predeploy (same address on testnet and mainnet).
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_RECIPIENTS = 50;

    address[] private _recipients;
    uint16[] private _sharesBps;

    mapping(address => uint256) public claimable;
    /// @notice Total credited USDC; invariant: IERC20(USDC).balanceOf(address(this)) >= totalClaimable.
    uint256 public totalClaimable;

    error LengthMismatch(uint256 recipientsLength, uint256 sharesLength);
    error EmptyRecipients();
    error TooManyRecipients(uint256 count);
    error InvalidRecipient(uint256 index, address recipient);
    error ZeroShare(uint256 index);
    error DuplicateRecipient(address recipient);
    error InvalidTotalShares(uint256 totalSharesBps);
    error ZeroAmount();
    error NothingToClaim();

    event Distributed(address indexed from, uint256 amount, string memo);
    event Payout(address indexed to, uint256 amount, uint16 shareBps);
    event Credited(address indexed to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    /**
     * @param recipients Ordered recipients; the final entry receives rounding dust.
     * @param sharesBps Positive shares in basis points, totaling exactly 10,000.
     * @dev Rejects this contract as a recipient so payouts cannot retain funds here.
     */
    constructor(address[] memory recipients, uint16[] memory sharesBps) {
        uint256 count = recipients.length;
        if (count != sharesBps.length) {
            revert LengthMismatch(count, sharesBps.length);
        }
        if (count == 0) revert EmptyRecipients();
        if (count > MAX_RECIPIENTS) revert TooManyRecipients(count);

        uint256 totalShares;
        for (uint256 i = 0; i < count; ++i) {
            address recipient = recipients[i];
            if (recipient == address(0) || recipient == address(this)) {
                revert InvalidRecipient(i, recipient);
            }
            if (sharesBps[i] == 0) revert ZeroShare(i);
            for (uint256 j = 0; j < i; ++j) {
                if (recipients[j] == recipient) revert DuplicateRecipient(recipient);
            }
            totalShares += sharesBps[i];
        }
        if (totalShares != BPS_DENOMINATOR) revert InvalidTotalShares(totalShares);

        _recipients = recipients;
        _sharesBps = sharesBps;
    }

    /// @notice Returns the number of configured recipients.
    function recipientCount() external view returns (uint256) {
        return _recipients.length;
    }

    /// @notice Returns both fixed configuration arrays in payout order.
    function getRecipients()
        external
        view
        returns (address[] memory recipients, uint16[] memory sharesBps)
    {
        return (_recipients, _sharesBps);
    }

    /**
     * @notice Pulls USDC from the caller, pushes payouts, and credits failed pushes.
     * @param amount USDC ERC-20 base units (1 USDC = 1e6); must be positive.
     * @param memo Free-form text included in the Distributed event.
     * @dev Caller must first approve this contract for at least amount USDC.
     * Uses floor(amount * shareBps / 10,000) for all but the last recipient,
     * whose payout is the remaining amount including all rounding dust.
     * Calculates payouts before external interactions; configuration never changes.
     * A failed pull reverts the entire distribution. A push that reverts or returns
     * false instead credits that recipient without blocking other payouts.
     * Zero payouts skip the token transfer and emit Payout with amount zero.
     * To attach an Arc transaction memo, an EOA calls Memo at
     * 0x5294E9927c3306DcBaDb03fe70b92e01cCede505 as
     * Memo.memo(address(SplitStream), abi.encodeCall(SplitStream.distribute, (amount, memo)), memoId, memoData),
     * where address(SplitStream) denotes this deployed instance. Memo uses CallFrom
     * so msg.sender, the Distributed from address, and the USDC allowance holder
     * remain the EOA. Contracts cannot call this wrapper (sender spoofing reverts);
     * SplitStream does not call Memo itself.
     */
    function distribute(uint256 amount, string calldata memo) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        uint256 count = _recipients.length;
        uint256[] memory payouts = new uint256[](count);
        uint256 remaining = amount;
        for (uint256 i = 0; i < count - 1; ++i) {
            uint256 payout = Math.mulDiv(amount, _sharesBps[i], BPS_DENOMINATOR);
            payouts[i] = payout;
            remaining -= payout;
        }
        payouts[count - 1] = remaining;

        IERC20 token = IERC20(USDC);
        token.safeTransferFrom(msg.sender, address(this), amount);
        for (uint256 i = 0; i < count; ++i) {
            address recipient = _recipients[i];
            uint256 payout = payouts[i];
            bool paid = payout == 0;
            if (payout != 0) {
                try IERC20(USDC).transfer(recipient, payout) returns (bool ok) {
                    paid = ok;
                } catch {}
            }
            if (paid) {
                emit Payout(recipient, payout, _sharesBps[i]);
            } else {
                claimable[recipient] += payout;
                totalClaimable += payout;
                emit Credited(recipient, payout);
            }
        }
        emit Distributed(msg.sender, amount, memo);
    }

    /**
     * @notice Withdraws the caller's credited USDC only to the caller.
     * @dev Clears credit before transferring. A failed transfer reverts all changes,
     * restoring the caller's credit without affecting any other recipient.
     */
    function withdraw() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender] = 0;
        totalClaimable -= amount;
        IERC20(USDC).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }
}
