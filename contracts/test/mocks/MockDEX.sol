// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockDEX
/// @notice Minimal mock DEX that accepts swap calls without reverting.
/// @dev For testing TradingAccount.execute() whitelist validation.
contract MockDEX {
    event Swapped(address tokenIn, address tokenOut, uint256 amount);

    /// @notice Mock swap function. Does nothing but emit an event.
    function swap(address tokenIn, address tokenOut, uint256 amount) external returns (bool) {
        emit Swapped(tokenIn, tokenOut, amount);
        return true;
    }
}
