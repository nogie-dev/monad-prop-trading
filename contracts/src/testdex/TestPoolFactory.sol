// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {TestPool} from "./TestPool.sol";

/// @title TestPoolFactory
/// @notice Deploys and tracks TestPool instances for unique token pairs.
///         Token ordering is canonicalised (lower address = token0) so that
///         getPool[A][B] and getPool[B][A] both resolve to the same pool.
contract TestPoolFactory {
    // -------------------------------------------------------------------------
    // Custom errors
    // -------------------------------------------------------------------------

    /// @notice Raised when a pool for the requested pair already exists
    error PoolAlreadyExists();

    /// @notice Raised when tokenA == tokenB
    error IdenticalTokens();

    /// @notice Raised when either token address is the zero address
    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new pool is deployed
    /// @param token0 The lower-address token of the pair
    /// @param token1 The higher-address token of the pair
    /// @param pool   Address of the newly deployed TestPool
    /// @param index  Zero-based index in allPools array
    event PoolCreated(address indexed token0, address indexed token1, address indexed pool, uint256 index);

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Look up pool address by ordered token pair.
    ///         Both getPool[token0][token1] and getPool[token1][token0] are set.
    mapping(address => mapping(address => address)) public getPool;

    /// @notice Enumerable list of all deployed pool addresses
    address[] public allPools;

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /// @notice Deploy a new constant-product pool for a token pair.
    ///         Tokens are sorted internally; caller order does not matter.
    /// @param tokenA One token of the pair
    /// @param tokenB The other token of the pair
    /// @return pool  Address of the newly deployed TestPool
    function createPool(address tokenA, address tokenB) external returns (address pool) {
        if (tokenA == tokenB) revert IdenticalTokens();
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();

        // Canonical ordering: token0 is the numerically smaller address
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        if (getPool[token0][token1] != address(0)) revert PoolAlreadyExists();

        // Deploy pool
        pool = address(new TestPool(token0, token1));

        // Register both directions for convenience
        getPool[token0][token1] = pool;
        getPool[token1][token0] = pool;

        allPools.push(pool);

        emit PoolCreated(token0, token1, pool, allPools.length - 1);
    }

    /// @notice Returns the total number of pools deployed by this factory
    /// @return Number of pools in allPools
    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }
}
