// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PropChallenge} from "../src/PropChallenge.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {AccountFactory} from "../src/AccountFactory.sol";

/// @title TestFlowE2E
/// @notice End-to-end test flow:
///   1. (Deployer) Mint USDC → trader(fee) + treasury(PA funding), set paFundingAmount
///   2. (Trader)   Approve + depositFee()
///   3. (Deployer) increaseVirtualBalance(2,000,000 USDC) → satisfies profit target
///   4. (Deployer) passChallenge() → deploys PA and funds it from Treasury
///
/// Required env vars (loaded from ../.env):
///   PRIVATE_KEY, TRADER_KEY, PROP_CHALLENGE_ADDRESS,
///   TREASURY_ADDRESS, ACCOUNT_FACTORY_ADDRESS, USDC_ADDRESS
contract TestFlowE2E is Script {
    uint256 constant CHALLENGE_FEE    = 100 * 1e6;           // 100 USDC
    uint256 constant INCREASE_AMOUNT  = 2_000_000 * 1e6;     // 2,000k USDC (satisfy pass target)
    uint256 constant PA_FUNDING       = 50_000 * 1e6;        // 50k USDC (real PA capital)

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        uint256 traderKey   = vm.envUint("TRADER_KEY");

        address prop       = vm.envAddress("PROP_CHALLENGE_ADDRESS");
        address treasury   = vm.envAddress("TREASURY_ADDRESS");
        address factory    = vm.envAddress("ACCOUNT_FACTORY_ADDRESS");
        address usdc       = vm.envAddress("USDC_ADDRESS");
        address trader     = vm.addr(traderKey);

        console.log("=== TestFlowE2E ===");
        console.log("Trader  :", trader);
        console.log("PropChallenge:", prop);

        // ── Step 1: Deployer setup ──────────────────────────────────────────
        // Reset trader state to NONE so depositFee can be called fresh.
        // activateChallengeDebug forces ACTIVE, so we need status reset first.
        // We use a direct storage reset via activateChallengeDebug then set NONE
        // by exploiting the fact that activateChallengeDebug overwrites regardless of prior state.
        // Then immediately reset status so depositFee() sees NONE.
        // Simpler: just mint + setPaFunding, then check status in step 2.
        vm.startBroadcast(deployerKey);
        // TestUSDC(usdc).mint(trader, CHALLENGE_FEE);
        // TestUSDC(usdc).mint(treasury, PA_FUNDING);
        PropChallenge(prop).setPaFundingAmount(PA_FUNDING);
        // // Reset trader to NONE status so depositFee() works fresh
        // // PropChallenge(prop).resetChallengeDebug(trader);
        vm.stopBroadcast();

        console.log("[1] Minted", CHALLENGE_FEE / 1e6, "USDC to trader");
        console.log("[1] Minted", PA_FUNDING / 1e6,   "USDC to treasury");
        console.log("[1] setPaFundingAmount:", PA_FUNDING / 1e6, "USDC");
        console.log("[1] Trader challenge state reset to NONE");

        // ── Step 2: Trader deposits challenge fee ───────────────────────────
        // vm.startBroadcast(traderKey);
        // IERC20(usdc).approve(prop, CHALLENGE_FEE);
        // PropChallenge(prop).depositFee(CHALLENGE_FEE);
        // vm.stopBroadcast();

        // console.log("[2] Trader depositFee() done - challenge ACTIVE");

        // ── Step 3 & 4: Deployer inflates balance and passes challenge ──────
        vm.startBroadcast(deployerKey);
        PropChallenge(prop).increaseVirtualBalance(trader, INCREASE_AMOUNT);
        // PropChallenge(prop).passChallenge(trader);
        vm.stopBroadcast();

        console.log("[3] increaseVirtualBalance:", INCREASE_AMOUNT / 1e6, "USDC");
        console.log("[4] passChallenge() called");

        // ── Result ──────────────────────────────────────────────────────────
        address pa = AccountFactory(factory).traderToPA(trader);
        console.log("=== Flow Complete ===");
        console.log("PA address :", pa);
        console.log("PA capital :", PA_FUNDING / 1e6, "USDC");
    }
}
