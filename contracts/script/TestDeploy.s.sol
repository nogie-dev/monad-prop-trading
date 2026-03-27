// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Treasury} from "../src/Treasury.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {PropChallenge} from "../src/PropChallenge.sol";
import {TestUSDC} from "../src/TestUSDC.sol";

/// @notice Deploys full stack with freshly minted TestUSDC for local/sandbox testing.
contract TestDeployScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // ── Config ──────────────────────────────────────────────────────
        address dexRouter = vm.envAddress("DEX_ROUTER");
        address weth = vm.envAddress("WETH_ADDRESS");
        address wbtc = vm.envAddress("WBTC_ADDRESS");

        uint256 challengeFee = vm.envOr("CHALLENGE_FEE", uint256(100e6)); // 100 USDC
        uint256 virtualInitial = vm.envOr("VIRTUAL_INITIAL", uint256(10_000e6)); // 10k
        uint256 profitTarget = vm.envOr("PROFIT_TARGET", uint256(11_000e6)); // 11k (10% gain)

        // DEX whitelist
        address[] memory dexTargets = new address[](1);
        dexTargets[0] = dexRouter;

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = bytes4(keccak256("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)"));
        selectors[1] = bytes4(keccak256("swap(address,address,uint256)"));

        address[] memory tokens = new address[](3);

        // ── Deploy ──────────────────────────────────────────────────────
        vm.startBroadcast(deployerKey);

        TestUSDC tusdc = new TestUSDC(deployer);
        tokens[0] = address(tusdc);
        tokens[1] = weth;
        tokens[2] = wbtc;

        Treasury treasury = new Treasury(address(tusdc), deployer);
        AccountFactory factory =
            new AccountFactory(deployer, address(treasury), address(tusdc), dexTargets, selectors, tokens);
        PropChallenge challenge = new PropChallenge(
            address(tusdc), address(treasury), deployer, challengeFee, virtualInitial, profitTarget
        );

        factory.setPropChallenge(address(challenge));
        challenge.setFactory(address(factory));
        challenge.setEvalToken(weth, true);
        challenge.setEvalToken(wbtc, true);

        vm.stopBroadcast();

        // ── Summary ─────────────────────────────────────────────────────
        console.log("=== Test Deployment Complete ===");
        console.log("TestUSDC:       ", address(tusdc));
        console.log("Treasury:       ", address(treasury));
        console.log("AccountFactory: ", address(factory));
        console.log("PropChallenge:  ", address(challenge));
        console.log("Owner:          ", deployer);
    }
}
