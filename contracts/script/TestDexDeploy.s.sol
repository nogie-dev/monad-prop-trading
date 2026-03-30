// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestERC20} from "../src/testdex/TestERC20.sol";
import {TestPool} from "../src/testdex/TestPool.sol";
import {TestPoolFactory} from "../src/testdex/TestPoolFactory.sol";
import {TestRouter} from "../src/testdex/TestRouter.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// @title TestDexDeploy
/// @notice Deploys WETH + WBTC tokens, a pool factory, a router, and seeds
///         USDC/WETH and USDC/WBTC pools at current market prices.
///
///         Prices used (Chainlink ETH mainnet, 2026-03-29):
///           ETH ≈ $2,004  →  pool ratio  200,000 USDC : 100 WETH
///           BTC ≈ $66,665 →  pool ratio  666,650 USDC :  10 WBTC
contract TestDexDeploy is Script {
    // Existing TestUSDC on Monad testnet (6 decimals, deployer is owner)
    address constant USDC = 0x4CcE72aD2238aaAeD9c5A93767255bA4D02CB525;

    // ── Liquidity amounts (~$1M TVL per pool) ────────────────────────────────
    // USDC/WETH pool  →  implied ETH price ≈ $2,000  ($500k each side)
    uint256 constant USDC_ETH_POOL = 500_000 * 1e6;   // 500,000 USDC
    uint256 constant WETH_POOL     = 250 * 1e18;       // 250 WETH  ≈ $500k

    // USDC/WBTC pool  →  implied BTC price ≈ $66,665  ($500k each side)
    uint256 constant USDC_BTC_POOL = 500_000 * 1e6;   // 500,000 USDC
    uint256 constant WBTC_POOL     = 750_000_000;       // 7.5 WBTC  ≈ $500k (8 decimals)

    function run() external {
        // Optional toggles (set in env; defaults keep previous behaviour)
        bool DO_DEPLOY_TOKENS = vm.envOr("DO_DEPLOY_TOKENS", false);   // false → reuse env WETH/WBTC only
        bool DO_MINT_TOKENS   = vm.envOr("DO_MINT_TOKENS", false);     // false → skip mint to deployer
        bool DO_MINT_USDC     = vm.envOr("DO_MINT_USDC", false);       // false → skip TestUSDC mint
        bool DO_DEPLOY_DEX    = vm.envOr("DO_DEPLOY_DEX", false);      // false → reuse env DEX_FACTORY/DEX_ROUTER
        bool DO_CREATE_POOLS  = vm.envOr("DO_CREATE_POOLS", false);    // false → reuse env POOL_USDC_WETH / POOL_USDC_WBTC

        vm.startBroadcast();
        address deployer = msg.sender;

        // ── 1. Deploy or reuse WETH & WBTC ───────────────────────────────────
        address wethAddr = vm.envOr("WETH_ADDRESS", address(0));
        address wbtcAddr = vm.envOr("WBTC_ADDRESS", address(0));

        TestERC20 weth = (wethAddr == address(0) && DO_DEPLOY_TOKENS)
            ? new TestERC20("Wrapped Ether", "WETH", 18)
            : TestERC20(wethAddr);
        TestERC20 wbtc = (wbtcAddr == address(0) && DO_DEPLOY_TOKENS)
            ? new TestERC20("Wrapped Bitcoin", "WBTC", 8)
            : TestERC20(wbtcAddr);

        if (address(weth) == address(0) || address(wbtc) == address(0)) {
            revert("Set WETH_ADDRESS/WBTC_ADDRESS or enable DO_DEPLOY_TOKENS");
        }

        console.log(wethAddr == address(0) ? "Deployed WETH:" : "Reusing WETH:", address(weth));
        console.log(wbtcAddr == address(0) ? "Deployed WBTC:" : "Reusing WBTC:", address(wbtc));

        if (DO_MINT_TOKENS) {
            weth.mint(deployer, WETH_POOL);
            wbtc.mint(deployer, WBTC_POOL);
        }

        // ── 2. Mint TestUSDC (deployer == owner) ─────────────────────────────
        uint256 totalUsdc = USDC_ETH_POOL + USDC_BTC_POOL; // 866,650 USDC
        if (DO_MINT_USDC) {
            IMintable(USDC).mint(deployer, totalUsdc);
        }

        // ── 3. Deploy factory & router ───────────────────────────────────────
        address factoryEnv = vm.envOr("DEX_FACTORY", address(0));
        address routerEnv  = vm.envOr("DEX_ROUTER", address(0));

        TestPoolFactory factory = (factoryEnv == address(0) && DO_DEPLOY_DEX)
            ? new TestPoolFactory()
            : TestPoolFactory(factoryEnv);
        TestRouter router = (routerEnv == address(0) && DO_DEPLOY_DEX)
            ? new TestRouter(address(factory))
            : TestRouter(routerEnv);

        if (address(factory) == address(0) || address(router) == address(0)) {
            revert("Set DEX_FACTORY/DEX_ROUTER or enable DO_DEPLOY_DEX");
        }
        console.log(factoryEnv == address(0) ? "TestPoolFactory deployed:" : "Reusing TestPoolFactory:", address(factory));
        console.log(routerEnv == address(0) ? "TestRouter deployed:     " : "Reusing TestRouter:     ", address(router));

        // ── 4. Create pools ──────────────────────────────────────────────────
        address ethPool;
        address btcPool;

        address ethPoolEnv = vm.envOr("POOL_USDC_WETH", address(0));
        address btcPoolEnv = vm.envOr("POOL_USDC_WBTC", address(0));

        if (DO_CREATE_POOLS) {
            ethPool = factory.createPool(USDC, address(weth));
            btcPool = factory.createPool(USDC, address(wbtc));
        } else {
            ethPool = ethPoolEnv;
            btcPool = btcPoolEnv;
        }

        if (ethPool == address(0) || btcPool == address(0)) {
            revert("Set POOL_USDC_WETH/POOL_USDC_WBTC or enable DO_CREATE_POOLS");
        }

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("=== TestDex Deployment ===");
        console.log("WETH       :", address(weth));
        console.log("WBTC       :", address(wbtc));
        console.log("Factory    :", address(factory));
        console.log("Router     :", address(router));
        console.log("USDC/WETH  :", ethPool);
        console.log("USDC/WBTC  :", btcPool);
        console.log("ETH price  : ~$2,000  (500,000 USDC / 250 WETH,  TVL ~$1M)");
        console.log("BTC price  : ~$66,667 (500,000 USDC / 7.5 WBTC, TVL ~$1M)");
    }
}
