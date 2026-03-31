// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {USDCFaucet} from "../src/USDCFaucet.sol";

interface IMintableERC20 {
    function mint(address to, uint256 amount) external;
}

contract DeployFaucetScript is Script {
    uint256 public constant FAUCET_MINT_AMOUNT = 1_000_000e6; // 1M tUSDC

    function run() external {
        address deployer = msg.sender;
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();

        USDCFaucet faucet = new USDCFaucet(usdc, deployer);
        console.log("USDCFaucet deployed:", address(faucet));

        IMintableERC20(usdc).mint(address(faucet), FAUCET_MINT_AMOUNT);
        console.log("Faucet funded: 1,000,000 tUSDC");

        vm.stopBroadcast();

        console.log("=== Faucet Deployment Complete ===");
        console.log("Faucet:  ", address(faucet));
        console.log("Owner:   ", deployer);
    }
}
