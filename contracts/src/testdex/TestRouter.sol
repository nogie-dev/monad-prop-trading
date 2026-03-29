// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TestPoolFactory} from "./TestPoolFactory.sol";
import {TestPool} from "./TestPool.sol";

/// @title TestRouter
/// @notice Convenience router: caller approves the router once, and the router
///         handles pool lookup, token pulling, pool approval, and swap execution.
///         No funds are ever held by this contract between calls.
contract TestRouter {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------

    /// @notice Raised when no pool exists for the requested token pair
    error PoolNotFound();

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice The factory used to look up pool addresses
    TestPoolFactory public immutable factory;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _factory Address of the deployed TestPoolFactory
    constructor(address _factory) {
        factory = TestPoolFactory(_factory);
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Swap an exact input amount of tokenIn for as much tokenOut as possible.
    ///         Caller must approve this router for at least `amountIn` of `tokenIn`.
    ///
    ///         Flow:
    ///           1. Resolve pool via factory
    ///           2. Pull tokenIn from msg.sender to this router
    ///           3. Approve pool to spend tokenIn (using forceApprove for OZ v5 safety)
    ///           4. Call pool.swap() — pool pulls from router, pushes tokenOut to `to`
    ///
    /// @param tokenIn      Token the caller is selling
    /// @param tokenOut     Token the caller wants to receive
    /// @param amountIn     Exact amount of tokenIn to sell
    /// @param minAmountOut Minimum acceptable amount of tokenOut (slippage guard)
    /// @param to           Recipient of tokenOut
    /// @return amountOut   Actual amount of tokenOut received by `to`
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) external returns (uint256 amountOut) {
        address poolAddr = factory.getPool(tokenIn, tokenOut);
        if (poolAddr == address(0)) revert PoolNotFound();

        // Pull tokenIn from caller into this router
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Approve pool to pull tokenIn from this router
        // forceApprove handles tokens that revert on non-zero -> non-zero approval (OZ v5)
        IERC20(tokenIn).forceApprove(poolAddr, amountIn);

        // Execute swap; pool transfers tokenOut directly to `to`
        amountOut = TestPool(poolAddr).swap(tokenIn, amountIn, minAmountOut, to);
    }

    /// @notice Preview the output amount for a swap, without executing it.
    ///         Reverts with PoolNotFound if the pair has no pool.
    /// @param tokenIn  Token being sold
    /// @param tokenOut Token being bought
    /// @param amountIn Amount of tokenIn to sell
    /// @return amountOut Expected output amount
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        address poolAddr = factory.getPool(tokenIn, tokenOut);
        if (poolAddr == address(0)) revert PoolNotFound();

        amountOut = TestPool(poolAddr).getAmountOut(tokenIn, amountIn);
    }
}
