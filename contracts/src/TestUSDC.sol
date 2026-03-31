// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title TestUSDC
/// @notice Simple USDC-like ERC20 with 6 decimals for local testing.
contract TestUSDC is ERC20, Ownable {
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10 ** 6; // 1B tokens (6 decimals)

    constructor(address initialOwner) ERC20("Test USD Coin", "tUSDC") Ownable(initialOwner) {
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /// @dev Override to match USDC's 6 decimals.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint additional test tokens.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
