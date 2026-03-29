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
        vm.startBroadcast();
        address deployer = msg.sender;

        // ── 1. Deploy WETH & WBTC ────────────────────────────────────────────
        TestERC20 weth = new TestERC20("Wrapped Ether",   "WETH", 18);
        TestERC20 wbtc = new TestERC20("Wrapped Bitcoin", "WBTC",  8);

        weth.mint(deployer, WETH_POOL);
        wbtc.mint(deployer, WBTC_POOL);

        // ── 2. Mint TestUSDC (deployer == owner) ─────────────────────────────
        uint256 totalUsdc = USDC_ETH_POOL + USDC_BTC_POOL; // 866,650 USDC
        IMintable(USDC).mint(deployer, totalUsdc);

        // ── 3. Deploy factory & router ───────────────────────────────────────
        TestPoolFactory factory = new TestPoolFactory();
        TestRouter      router  = new TestRouter(address(factory));

        // ── 4. Create pools ──────────────────────────────────────────────────
        address ethPool = factory.createPool(USDC, address(weth));
        address btcPool = factory.createPool(USDC, address(wbtc));

        // ── 5. Seed USDC/WETH pool ───────────────────────────────────────────
        {
            // Pool stores token0 < token1 by address; determine correct order.
            bool usdcFirst = USDC < address(weth);
            uint256 amt0   = usdcFirst ? USDC_ETH_POOL : WETH_POOL;
            uint256 amt1   = usdcFirst ? WETH_POOL      : USDC_ETH_POOL;

            IERC20(USDC).approve(ethPool, USDC_ETH_POOL);
            weth.approve(ethPool, WETH_POOL);
            TestPool(ethPool).addLiquidity(amt0, amt1);
        }

        // ── 6. Seed USDC/WBTC pool ───────────────────────────────────────────
        {
            bool usdcFirst = USDC < address(wbtc);
            uint256 amt0   = usdcFirst ? USDC_BTC_POOL : WBTC_POOL;
            uint256 amt1   = usdcFirst ? WBTC_POOL      : USDC_BTC_POOL;

            IERC20(USDC).approve(btcPool, USDC_BTC_POOL);
            wbtc.approve(btcPool, WBTC_POOL);
            TestPool(btcPool).addLiquidity(amt0, amt1);
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
