// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Treasury} from "../src/Treasury.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {PropChallenge} from "../src/PropChallenge.sol";

contract DeployScript is Script {
    // Toggle individual steps for partial redeploys.
    // Set to false to reuse existing deployments via env variables.
    // Full redeploy of Treasury, Factory, and PropChallenge.
    bool public constant DEPLOY_TREASURY = true;
    bool public constant DEPLOY_FACTORY = true;
    bool public constant DEPLOY_PROP_CHALLENGE = true;
    bool public constant WIRE_FACTORY_CHALLENGE = true;
    bool public constant SET_EVAL_TOKENS = true;

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
        uint256 paFunding = vm.envOr("PA_FUNDING_AMOUNT", uint256(50_000e6)); // 50k USDC

        // ── Deploy ──────────────────────────────────────────────────────
        vm.startBroadcast();

        address treasury = _deployOrUseTreasury(usdc, deployer);
        address factory = _deployOrUseFactory(deployer, treasury, usdc, dexRouter, weth, wbtc);
        address challenge =
            _deployOrUsePropChallenge(usdc, treasury, deployer, challengeFee, virtualInitial, profitTarget, paFunding);

        if (WIRE_FACTORY_CHALLENGE) {
            AccountFactory(factory).setPropChallenge(address(challenge));
            PropChallenge(challenge).setFactory(factory);
            Treasury(treasury).setPropChallenge(challenge);
        }

        if (SET_EVAL_TOKENS) {
            PropChallenge(challenge).setEvalToken(weth, true);
            PropChallenge(challenge).setEvalToken(wbtc, true);
        }

        vm.stopBroadcast();

        // ── Summary ─────────────────────────────────────────────────────
        console.log("=== Deployment Complete ===");
        console.log("Treasury:       ", treasury);
        console.log("AccountFactory: ", factory);
        console.log("PropChallenge:  ", challenge);
        console.log("Owner:          ", deployer);
    }

    // Deploy Treasury or reuse existing address via env TREASURY_ADDRESS.
    function _deployOrUseTreasury(address usdc, address owner) internal returns (address) {
        if (DEPLOY_TREASURY) {
            Treasury treasury = new Treasury(usdc, owner);
            console.log("Treasury deployed:", address(treasury));
            return address(treasury);
        }
        address existing = vm.envOr("TREASURY_ADDRESS", address(0));
        require(existing != address(0), "TREASURY_ADDRESS not set");
        console.log("Treasury (existing):", existing);
        return existing;
    }

    // Deploy AccountFactory or reuse existing via env ACCOUNT_FACTORY_ADDRESS.
    function _deployOrUseFactory(
        address owner,
        address treasury,
        address usdc,
        address dexRouter,
        address weth,
        address wbtc
    ) internal returns (address) {
        if (DEPLOY_FACTORY) {
            address[] memory dexTargets = new address[](1);
            dexTargets[0] = dexRouter;

            bytes4[] memory selectors = new bytes4[](1);
            selectors[0] = bytes4(keccak256("swapExactIn(address,address,uint256,uint256,address)"));

            address[] memory tokens = new address[](3);
            tokens[0] = usdc;
            tokens[1] = weth;
            tokens[2] = wbtc;

            AccountFactory factory = new AccountFactory(owner, treasury, usdc, dexTargets, selectors, tokens);
            console.log("AccountFactory deployed:", address(factory));
            return address(factory);
        }
        address existing = vm.envOr("ACCOUNT_FACTORY_ADDRESS", address(0));
        require(existing != address(0), "ACCOUNT_FACTORY_ADDRESS not set");
        console.log("AccountFactory (existing):", existing);
        return existing;
    }

    // Deploy PropChallenge or reuse existing via env PROP_CHALLENGE_ADDRESS.
    function _deployOrUsePropChallenge(
        address usdc,
        address treasury,
        address owner,
        uint256 challengeFee,
        uint256 virtualInitial,
        uint256 profitTarget,
        uint256 paFunding
    ) internal returns (address) {
        if (DEPLOY_PROP_CHALLENGE) {
            PropChallenge challenge =
                new PropChallenge(usdc, treasury, owner, challengeFee, virtualInitial, profitTarget, paFunding);
            console.log("PropChallenge deployed:", address(challenge));
            return address(challenge);
        }
        address existing = vm.envOr("PROP_CHALLENGE_ADDRESS", address(0));
        require(existing != address(0), "PROP_CHALLENGE_ADDRESS not set");
        console.log("PropChallenge (existing):", existing);
        return existing;
    }
}
