// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Minimal ERC-20 interface (USDC on Arc — the 6-decimal ERC-20 token).
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title  SplitStream — a blocklist-safe USDC revenue splitter for Arc
/// @notice Pulls USDC from the caller and pays each recipient their basis-point
///         share in one transaction. A recipient that cannot receive (e.g.
///         USDC-blocklisted) is credited a claimable balance instead of
///         reverting the whole split, so one bad address can't brick the pool.
/// @dev    Reference implementation to sanity-check Arc Studio's output.
///         - USDC on Arc is the 6-DECIMAL ERC-20 token (1 USDC = 1_000_000).
///           The 18-decimal view is only Arc's native-gas (msg.value) path.
///         - Set `usdc_` to Arc's real USDC address (see
///           docs.arc.io/arc/references/contract-addresses). Do NOT hardcode a
///           guessed address.
///         - The caller must approve this contract for `amount` before distribute.
///         - The `memo` is emitted here; to put the reference ON-CHAIN as a
///           first-class memo, wire Arc's Memo contract per
///           docs.arc.io transaction-memos (left to Studio + the docs so no
///           interface is invented here).
contract SplitStream {
    IERC20 public immutable usdc;
    address[] public recipients;
    uint256[] public sharesBps;                 // each share in basis points; must sum to 10_000
    mapping(address => uint256) public claimable; // credited when a direct payout fails

    uint256 private _locked;                    // minimal reentrancy guard

    event Payout(address indexed to, uint256 amount, uint256 shareBps);
    event Credited(address indexed to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Distributed(address indexed from, uint256 amount, string memo);

    modifier nonReentrant() {
        require(_locked == 0, "reentrant");
        _locked = 1;
        _;
        _locked = 0;
    }

    constructor(address usdc_, address[] memory recipients_, uint256[] memory sharesBps_) {
        require(
            recipients_.length == sharesBps_.length && recipients_.length > 0,
            "bad config"
        );
        uint256 total;
        for (uint256 i = 0; i < sharesBps_.length; i++) {
            require(recipients_[i] != address(0), "zero recipient");
            require(sharesBps_[i] > 0, "zero share");
            total += sharesBps_[i];
        }
        require(total == 10_000, "shares must sum to 10000");
        usdc = IERC20(usdc_);
        recipients = recipients_;
        sharesBps = sharesBps_;
    }

    /// @notice Pull `amount` (6-decimal USDC) from the caller and split it.
    ///         A recipient whose transfer fails is credited, not reverted.
    /// @param amount USDC amount in 6-decimal units (1 USDC = 1_000_000).
    /// @param memo   Free reference, e.g. an invoice id, carried in the event.
    function distribute(uint256 amount, string calldata memo) external nonReentrant {
        require(amount > 0, "zero amount");
        require(usdc.transferFrom(msg.sender, address(this), amount), "pull failed");

        uint256 distributed;
        uint256 n = recipients.length;
        for (uint256 i = 0; i < n; i++) {
            uint256 share = (i == n - 1) ? amount - distributed : (amount * sharesBps[i]) / 10_000;
            if (i != n - 1) distributed += share;

            address to = recipients[i];
            // Try a direct transfer; on revert OR a false return, credit instead.
            try usdc.transfer(to, share) returns (bool ok) {
                if (ok) {
                    emit Payout(to, share, sharesBps[i]);
                } else {
                    claimable[to] += share;
                    emit Credited(to, share);
                }
            } catch {
                claimable[to] += share;
                emit Credited(to, share);
            }
        }
        emit Distributed(msg.sender, amount, memo);
    }

    /// @notice Withdraw any balance credited to the caller when a payout failed.
    function withdraw() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        require(amount > 0, "nothing to withdraw");
        claimable[msg.sender] = 0;              // zero before transfer
        require(usdc.transfer(msg.sender, amount), "withdraw failed");
        emit Withdrawn(msg.sender, amount);
    }
}
