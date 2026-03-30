// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestPool} from "../src/testdex/TestPool.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// @title SeedPools
/// @notice Seeds USDC/WETH and USDC/WBTC pools with liquidity.
///         Also funds Treasury with USDC for PA payouts.
contract SeedPools is Script {
    address constant USDC    = 0x4CcE72aD2238aaAeD9c5A93767255bA4D02CB525;
    address constant WETH    = 0xbeC6b351fD2513A2aCa7747370438E744b3E9704;
    address constant WBTC    = 0xD435C08700CEB4a75eb55A0156206646baEB5Cc7;
    address constant ETH_POOL = 0xd491D6e855da09e90C0e61b5d09C4eA1a670B093;
    address constant BTC_POOL = 0xBB866f8514F5B0A42B57190970E6F18a8a2ad0cD;
    address constant TREASURY = 0x60627Dfb136C044E431fb4b5555627fd074DA1cF;

    uint256 constant USDC_ETH  = 500_000 * 1e6;    // 500k USDC
    uint256 constant WETH_AMT  = 250 * 1e18;        // 250 WETH  (~$2,000 each)
    uint256 constant USDC_BTC  = 500_000 * 1e6;    // 500k USDC
    uint256 constant WBTC_AMT  = 750_000_000;        // 7.5 WBTC (8 dec, ~$66,667 each)
    uint256 constant TREASURY_FUND = 100_000 * 1e6; // 100k USDC

    function run() external {
        vm.startBroadcast();

        // ── Seed USDC/WETH pool (token0=USDC, token1=WETH) ──────────────────
        IERC20(USDC).approve(ETH_POOL, USDC_ETH);
        IERC20(WETH).approve(ETH_POOL, WETH_AMT);
        TestPool(ETH_POOL).addLiquidity(USDC_ETH, WETH_AMT);
        console.log("USDC/WETH pool seeded");

        // ── Seed USDC/WBTC pool (token0=USDC, token1=WBTC) ──────────────────
        IERC20(USDC).approve(BTC_POOL, USDC_BTC);
        IERC20(WBTC).approve(BTC_POOL, WBTC_AMT);
        TestPool(BTC_POOL).addLiquidity(USDC_BTC, WBTC_AMT);
        console.log("USDC/WBTC pool seeded");

        // ── Fund Treasury ─────────────────────────────────────────────────────
        IMintable(USDC).mint(TREASURY, TREASURY_FUND);
        console.log("Treasury funded:", TREASURY_FUND / 1e6, "USDC");

        vm.stopBroadcast();

        console.log("=== SeedPools Complete ===");
        uint256 ethReserve0 = TestPool(ETH_POOL).reserve0();
        uint256 btcReserve0 = TestPool(BTC_POOL).reserve0();
        console.log("ETH pool reserve0:", ethReserve0 / 1e6, "USDC");
        console.log("BTC pool reserve0:", btcReserve0 / 1e6, "USDC");
    }
}
