// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestERC20} from "../src/testdex/TestERC20.sol";
import {TestPool} from "../src/testdex/TestPool.sol";
import {TestPoolFactory} from "../src/testdex/TestPoolFactory.sol";
import {TestRouter} from "../src/testdex/TestRouter.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {PropChallenge} from "../src/PropChallenge.sol";

interface IMintable {
    function mint(address to, uint256 amount) external;
}

/// @title FixRedeploy
/// @notice Redeploys WETH, WBTC, TestDex, and AccountFactory with correct addresses.
///         Keeps PropChallenge, Treasury, and USDC as-is.
///         Wires everything together and funds Treasury.
///
/// Root cause: previous deployment had address collision due to nonce mismatch.
/// WETH address contained Treasury bytecode; Router had no code.
contract FixRedeploy is Script {
    // Existing contracts (keep these)
    address constant USDC      = 0x4CcE72aD2238aaAeD9c5A93767255bA4D02CB525;
    address constant TREASURY  = 0x60627Dfb136C044E431fb4b5555627fd074DA1cF;
    address constant PROP_CHALLENGE = 0xF646b4387d0138bab3280cC5d257192a42a99f3a;

    // Pool liquidity (~$1M TVL each)
    uint256 constant USDC_ETH_POOL = 500_000 * 1e6;   // 500k USDC
    uint256 constant WETH_POOL     = 250 * 1e18;       // 250 WETH  (~$2,000 each)
    uint256 constant USDC_BTC_POOL = 500_000 * 1e6;   // 500k USDC
    uint256 constant WBTC_POOL     = 750_000_000;       // 7.5 WBTC (8 dec, ~$66,667 each)

    // Treasury funding
    uint256 constant TREASURY_FUND = 100_000 * 1e6;   // 100k USDC for PA funding

    function run() external {
        vm.startBroadcast();
        address deployer = msg.sender;

        // ── 1. Deploy WETH & WBTC ────────────────────────────────────────────
        TestERC20 weth = new TestERC20("Wrapped Ether",   "WETH", 18);
        TestERC20 wbtc = new TestERC20("Wrapped Bitcoin", "WBTC",  8);

        weth.mint(deployer, WETH_POOL);
        wbtc.mint(deployer, WBTC_POOL);

        console.log("WETH:", address(weth));
        console.log("WBTC:", address(wbtc));

        // ── 2. Mint USDC for pool seeding ────────────────────────────────────
        uint256 totalUsdc = USDC_ETH_POOL + USDC_BTC_POOL;
        IMintable(USDC).mint(deployer, totalUsdc);

        // ── 3. Deploy TestDex factory & router ───────────────────────────────
        TestPoolFactory dexFactory = new TestPoolFactory();
        TestRouter      router     = new TestRouter(address(dexFactory));

        console.log("DEX Factory:", address(dexFactory));
        console.log("DEX Router: ", address(router));

        // ── 4. Create & seed USDC/WETH pool ──────────────────────────────────
        address ethPool = dexFactory.createPool(USDC, address(weth));
        {
            bool usdcFirst = USDC < address(weth);
            uint256 amt0   = usdcFirst ? USDC_ETH_POOL : WETH_POOL;
            uint256 amt1   = usdcFirst ? WETH_POOL      : USDC_ETH_POOL;
            IERC20(USDC).approve(ethPool, USDC_ETH_POOL);
            weth.approve(ethPool, WETH_POOL);
            TestPool(ethPool).addLiquidity(amt0, amt1);
        }
        console.log("USDC/WETH pool:", ethPool);

        // ── 5. Create & seed USDC/WBTC pool ──────────────────────────────────
        address btcPool = dexFactory.createPool(USDC, address(wbtc));
        {
            bool usdcFirst = USDC < address(wbtc);
            uint256 amt0   = usdcFirst ? USDC_BTC_POOL : WBTC_POOL;
            uint256 amt1   = usdcFirst ? WBTC_POOL      : USDC_BTC_POOL;
            IERC20(USDC).approve(btcPool, USDC_BTC_POOL);
            wbtc.approve(btcPool, WBTC_POOL);
            TestPool(btcPool).addLiquidity(amt0, amt1);
        }
        console.log("USDC/WBTC pool:", btcPool);

        // ── 6. Deploy new AccountFactory ─────────────────────────────────────
        address[] memory dexTargets = new address[](1);
        dexTargets[0] = address(router);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = bytes4(keccak256("swapExactIn(address,address,uint256,uint256,address)"));

        address[] memory tokens = new address[](3);
        tokens[0] = USDC;
        tokens[1] = address(weth);
        tokens[2] = address(wbtc);

        AccountFactory factory = new AccountFactory(deployer, TREASURY, USDC, dexTargets, selectors, tokens);
        console.log("AccountFactory:", address(factory));

        // ── 7. Wire contracts ─────────────────────────────────────────────────
        factory.setPropChallenge(PROP_CHALLENGE);
        PropChallenge(PROP_CHALLENGE).setFactory(address(factory));
        PropChallenge(PROP_CHALLENGE).setEvalToken(address(weth), true);
        PropChallenge(PROP_CHALLENGE).setEvalToken(address(wbtc), true);

        console.log("Contracts wired.");

        // ── 8. Fund Treasury for PA payouts ──────────────────────────────────
        IMintable(USDC).mint(TREASURY, TREASURY_FUND);
        console.log("Treasury funded:", TREASURY_FUND / 1e6, "USDC");

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("=== FixRedeploy Complete ===");
        console.log("WETH_ADDRESS=", address(weth));
        console.log("WBTC_ADDRESS=", address(wbtc));
        console.log("DEX_ROUTER=", address(router));
        console.log("ACCOUNT_FACTORY_ADDRESS=", address(factory));
        console.log("(PropChallenge/Treasury/USDC unchanged)");
    }
}
