// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Minimal ERC-20 interface (USDC on Arc).
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title  SplitStream — a USDC revenue splitter for Arc
/// @notice Pulls USDC from the caller and forwards each recipient their
///         basis-point share in a single transaction.
/// @dev    Reference implementation to sanity-check Arc Studio's output.
///         - Set `usdc_` to Arc's native USDC address (see
///           docs.arc.io/arc/references/contract-addresses). Do NOT hardcode a
///           guessed address.
///         - The `memo` is emitted here; to put the reference ON-CHAIN as a
///           first-class memo, wire Arc's Memo contract per
///           docs.arc.io transaction-memos (left to Studio + the docs so no
///           interface is invented here).
contract SplitStream {
    IERC20 public immutable usdc;
    address[] public recipients;
    uint256[] public sharesBps; // each recipient's share in basis points; must sum to 10_000

    event Distributed(address indexed from, uint256 amount, string memo);
    event Payout(address indexed to, uint256 amount, uint256 shareBps);

    constructor(address usdc_, address[] memory recipients_, uint256[] memory sharesBps_) {
        require(
            recipients_.length == sharesBps_.length && recipients_.length > 0,
            "bad config"
        );
        uint256 total;
        for (uint256 i = 0; i < sharesBps_.length; i++) {
            require(recipients_[i] != address(0), "zero recipient");
            total += sharesBps_[i];
        }
        require(total == 10_000, "shares must sum to 10000");
        usdc = IERC20(usdc_);
        recipients = recipients_;
        sharesBps = sharesBps_;
    }

    /// @notice Pull `amount` USDC from the caller and split it across recipients.
    /// @param amount USDC amount (18 decimals on Arc) to pull and split.
    /// @param memo   Free reference, e.g. an invoice id, carried in the event.
    function distribute(uint256 amount, string calldata memo) external {
        require(amount > 0, "zero amount");
        require(usdc.transferFrom(msg.sender, address(this), amount), "pull failed");

        uint256 distributed;
        uint256 n = recipients.length;
        for (uint256 i = 0; i < n; i++) {
            uint256 share;
            if (i == n - 1) {
                share = amount - distributed; // last recipient takes the rounding dust
            } else {
                share = (amount * sharesBps[i]) / 10_000;
                distributed += share;
            }
            require(usdc.transfer(recipients[i], share), "payout failed");
            emit Payout(recipients[i], share, sharesBps[i]);
        }
        emit Distributed(msg.sender, amount, memo);
    }
}
