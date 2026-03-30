// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Treasury
/// @notice Platform fund management. Holds USDC for funding PAs and collecting profits.
contract Treasury is Ownable, ReentrancyGuard {
    // ── Errors ──────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();
    error NotAuthorized();

    // ── Events ──────────────────────────────────────────────────────────
    event AccountFunded(address indexed pa, uint256 amount);
    event FundsReceived(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // ── State ───────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    address public propChallenge;

    constructor(address _usdc, address _owner) Ownable(_owner) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
    }

    /// @notice Set PropChallenge that can trigger funding.
    function setPropChallenge(address _propChallenge) external onlyOwner {
        if (_propChallenge == address(0)) revert ZeroAddress();
        propChallenge = _propChallenge;
    }

    /// @notice Fund a Performance Account with USDC.
    /// @param pa The TradingAccount address.
    /// @param amount USDC amount to transfer.
    function fundAccount(address pa, uint256 amount) external nonReentrant {
        if (msg.sender != owner() && msg.sender != propChallenge) revert NotAuthorized();
        if (pa == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientBalance();

        usdc.transfer(pa, amount);
        emit AccountFunded(pa, amount);
    }

    /// @notice Receive USDC from PA contracts (settle/forceClose).
    /// @dev PA contracts transfer directly; this is for event tracking.
    function receiveFunds(uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        emit FundsReceived(msg.sender, amount);
    }

    /// @notice Withdraw platform profits.
    /// @param to Destination address.
    /// @param amount USDC amount.
    function withdraw(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientBalance();

        usdc.transfer(to, amount);
        emit Withdrawn(to, amount);
    }
}
