// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Treasury} from "../src/Treasury.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {PropChallenge} from "../src/PropChallenge.sol";

contract DeployScript is Script {
    function run() external {
        // ── Config ──────────────────────────────────────────────────────
        address deployer = msg.sender;
        address usdc = vm.envAddress("USDC_ADDRESS");

        // DEX whitelist
        address dexRouter = vm.envAddress("DEX_ROUTER");
        address weth = vm.envAddress("WETH_ADDRESS");
        address wbtc = vm.envAddress("WBTC_ADDRESS");

        // Challenge params
        uint256 challengeFee = vm.envOr("CHALLENGE_FEE", uint256(100e6)); // 100 USDC
        uint256 virtualInitial = vm.envOr("VIRTUAL_INITIAL", uint256(10_000e6)); // 10k
        uint256 profitTarget = vm.envOr("PROFIT_TARGET", uint256(11_000e6)); // 11k (10% gain)

        // ── Deploy ──────────────────────────────────────────────────────
        vm.startBroadcast();

        // 1. Treasury
        Treasury treasury = new Treasury(usdc, deployer);
        console.log("Treasury:", address(treasury));

        // 2. AccountFactory
        address[] memory dexTargets = new address[](1);
        dexTargets[0] = dexRouter;

        // TestRouter selector
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = bytes4(keccak256("swapExactIn(address,address,uint256,uint256,address)"));

        address[] memory tokens = new address[](3);
        tokens[0] = usdc;
        tokens[1] = weth;
        tokens[2] = wbtc;

        AccountFactory factory = new AccountFactory(deployer, address(treasury), usdc, dexTargets, selectors, tokens);
        console.log("AccountFactory:", address(factory));

        // 3. PropChallenge
        PropChallenge challenge =
            new PropChallenge(usdc, address(treasury), deployer, challengeFee, virtualInitial, profitTarget);
        console.log("PropChallenge:", address(challenge));

        // 4. Wire up
        factory.setPropChallenge(address(challenge));
        challenge.setFactory(address(factory));

        // Set eval tokens
        challenge.setEvalToken(weth, true);
        challenge.setEvalToken(wbtc, true);

        vm.stopBroadcast();

        // ── Summary ─────────────────────────────────────────────────────
        console.log("=== Deployment Complete ===");
        console.log("Treasury:       ", address(treasury));
        console.log("AccountFactory: ", address(factory));
        console.log("PropChallenge:  ", address(challenge));
        console.log("Owner:          ", deployer);
    }
}