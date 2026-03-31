// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title USDCFaucet
/// @notice Drips 100 tUSDC per address per cooldown period. No auth required.
contract USDCFaucet is Ownable {
    // ── Errors ──────────────────────────────────────────────────────────
    error CooldownNotElapsed(uint256 remainingSeconds);
    error InsufficientFaucetBalance();
    error ZeroAddress();

    // ── Events ──────────────────────────────────────────────────────────
    event Dripped(address indexed to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // ── State ────────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    uint256 public constant DRIP_AMOUNT = 100e6;  // 100 USDC (6 decimals)
    uint256 public constant COOLDOWN = 1 hours;

    mapping(address => uint256) public lastClaim;

    constructor(address _usdc, address _owner) Ownable(_owner) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
    }

    /// @notice Send 100 tUSDC to caller. Enforces 1-hour cooldown per address.
    function drip() external {
        uint256 last = lastClaim[msg.sender];
        if (block.timestamp < last + COOLDOWN) {
            revert CooldownNotElapsed(last + COOLDOWN - block.timestamp);
        }
        if (usdc.balanceOf(address(this)) < DRIP_AMOUNT) revert InsufficientFaucetBalance();

        lastClaim[msg.sender] = block.timestamp;
        usdc.transfer(msg.sender, DRIP_AMOUNT);
        emit Dripped(msg.sender, DRIP_AMOUNT);
    }

    /// @notice Seconds remaining until caller can claim again. 0 = claimable now.
    function cooldownRemaining(address user) external view returns (uint256) {
        uint256 eligible = lastClaim[user] + COOLDOWN;
        if (block.timestamp >= eligible) return 0;
        return eligible - block.timestamp;
    }

    /// @notice Owner can recover funds from the faucet.
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        usdc.transfer(to, amount);
        emit Withdrawn(to, amount);
    }
}
