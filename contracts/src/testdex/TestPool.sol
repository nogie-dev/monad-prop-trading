// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TestPool
/// @notice Constant-product (x*y=k) AMM pool for a single token pair.
///         0.3% swap fee (997/1000 factor). Designed for hackathon testnet use.
contract TestPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------

    /// @notice Raised when either reserve is zero (pool has no liquidity)
    error InsufficientLiquidity();

    /// @notice Raised when computed output is below caller's minAmountOut
    error InsufficientOutputAmount();

    /// @notice Raised when tokenIn is neither token0 nor token1
    error InvalidToken();

    /// @notice Raised when amountIn is zero
    error ZeroAmountIn();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when liquidity is added to the pool
    /// @param provider  Address that provided liquidity
    /// @param amount0   Amount of token0 deposited
    /// @param amount1   Amount of token1 deposited
    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1);

    /// @notice Emitted on every swap
    /// @param sender    Address that initiated the swap
    /// @param tokenIn   Token sent into the pool
    /// @param amountIn  Amount sent in
    /// @param tokenOut  Token sent out of the pool
    /// @param amountOut Amount sent out
    /// @param to        Recipient of tokenOut
    event Swap(
        address indexed sender,
        address indexed tokenIn,
        uint256 amountIn,
        address indexed tokenOut,
        uint256 amountOut,
        address to
    );

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice The lower-address token of the pair (token0 < token1)
    address public immutable token0;

    /// @notice The higher-address token of the pair
    address public immutable token1;

    /// @notice Current reserve of token0 held by this pool
    uint256 public reserve0;

    /// @notice Current reserve of token1 held by this pool
    uint256 public reserve1;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _token0 Must be the numerically smaller address
    /// @param _token1 Must be the numerically larger address
    constructor(address _token0, address _token1) {
        // Caller (factory) is responsible for ordering; we enforce it here too.
        require(_token0 < _token1, "TestPool: token0 >= token1");
        token0 = _token0;
        token1 = _token1;
    }

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Deposit both tokens to provide liquidity.
    ///         Caller must have approved this contract for both tokens beforehand.
    /// @param amount0 Amount of token0 to deposit
    /// @param amount1 Amount of token1 to deposit
    function addLiquidity(uint256 amount0, uint256 amount1) external nonReentrant {
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1);

        reserve0 += amount0;
        reserve1 += amount1;

        emit LiquidityAdded(msg.sender, amount0, amount1);
    }

    /// @notice Swap an exact amount of one token for the other using x*y=k.
    ///         A 0.3% fee is deducted from amountIn before computing output.
    ///         Caller must have approved this contract for tokenIn beforehand.
    /// @param tokenIn     The token being sold into the pool
    /// @param amountIn    Exact amount of tokenIn to sell
    /// @param minAmountOut Minimum acceptable output (slippage guard)
    /// @param to          Address that receives tokenOut
    /// @return amountOut  Actual amount of tokenOut transferred to `to`
    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut, address to)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert ZeroAmountIn();
        if (tokenIn != token0 && tokenIn != token1) revert InvalidToken();

        amountOut = getAmountOut(tokenIn, amountIn);
        if (amountOut < minAmountOut) revert InsufficientOutputAmount();

        address tokenOut = tokenIn == token0 ? token1 : token0;

        // Pull tokenIn from caller
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Push tokenOut to recipient
        IERC20(tokenOut).safeTransfer(to, amountOut);

        // Update reserves
        if (tokenIn == token0) {
            reserve0 += amountIn;
            reserve1 -= amountOut;
        } else {
            reserve1 += amountIn;
            reserve0 -= amountOut;
        }

        emit Swap(msg.sender, tokenIn, amountIn, tokenOut, amountOut, to);
    }

    /// @notice Preview the output amount for a given swap, without executing it.
    /// @param tokenIn  The token being sold
    /// @param amountIn The amount of tokenIn to sell
    /// @return amountOut Expected output before slippage (read-only)
    function getAmountOut(address tokenIn, uint256 amountIn) public view returns (uint256 amountOut) {
        if (tokenIn != token0 && tokenIn != token1) revert InvalidToken();
        if (reserve0 == 0 || reserve1 == 0) revert InsufficientLiquidity();

        // Select correct reserves
        (uint256 reserveIn, uint256 reserveOut) =
            tokenIn == token0 ? (reserve0, reserve1) : (reserve1, reserve0);

        // x*y=k with 0.3% fee: amountInWithFee = amountIn * 997
        // amountOut = (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee)
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }
}
