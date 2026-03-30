// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {PropChallenge} from "../src/PropChallenge.sol";
import {TestUSDC} from "../src/TestUSDC.sol";

/// @notice Debug helper script to toggle activate/increase/decrease on a trader.
contract TestDebugTrigger is Script {
    // Toggle actions (set true/false before running).
    bool public constant DO_ACTIVATE = false;
    bool public constant DO_INCREASE = false;
    bool public constant DO_DECREASE = false;
    bool public constant DO_PASS = false;
    bool public constant DO_SET_FUNDING = false;
    bool public constant DO_MINT_TREASURY = true;

    function run() external {
        // Required env vars:
        // - PRIVATE_KEY: owner key for PropChallenge
        // - PROP_CHALLENGE_ADDRESS: target PropChallenge
        // - TREASURY_ADDRESS: target treasury (for mint)
        // - USDC_ADDRESS: TestUSDC address (for mint)
        // - DEBUG_TRADER: trader address to mutate
        // - DEBUG_AMOUNT: amount for inc/dec/funding/mint (uint, 6 decimals for USDC)
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address prop = vm.envAddress("PROP_CHALLENGE_ADDRESS");
        address treasury = vm.envOr("TREASURY_ADDRESS", address(0));
        address usdc = vm.envOr("USDC_ADDRESS", address(0));
        address trader = vm.envAddress("DEBUG_TRADER");
        uint256 amount = vm.envOr("DEBUG_AMOUNT", uint256(0));

        vm.startBroadcast(deployerKey);

        if (DO_ACTIVATE) {
            PropChallenge(prop).activateChallengeDebug(trader);
        }
        if (DO_INCREASE && amount > 0) {
            PropChallenge(prop).increaseVirtualBalance(trader, amount);
        }
        if (DO_DECREASE && amount > 0) {
            PropChallenge(prop).decreaseVirtualBalance(trader, amount);
        }
        if (DO_PASS) {
            PropChallenge(prop).passChallenge(trader);
        }
        if (DO_SET_FUNDING && amount > 0) {
            PropChallenge(prop).setPaFundingAmount(amount);
        }
        if (DO_MINT_TREASURY && amount > 0) {
            // Mint TestUSDC into treasury for debugging (requires owner key of TestUSDC).
            if (treasury == address(0) || usdc == address(0)) revert("Set TREASURY_ADDRESS/USDC_ADDRESS");
            TestUSDC(usdc).mint(treasury, amount);
        }

        vm.stopBroadcast();
    }
}
