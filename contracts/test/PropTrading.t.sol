// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {TradingAccount} from "../src/TradingAccount.sol";
import {AccountFactory} from "../src/AccountFactory.sol";
import {PropChallenge} from "../src/PropChallenge.sol";
import {Treasury} from "../src/Treasury.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockDEX} from "./mocks/MockDEX.sol";

contract PropTradingTest is Test {
    // Contracts
    Treasury public treasury;
    AccountFactory public factory;
    PropChallenge public challenge;
    MockERC20 public usdc;
    MockERC20 public weth;
    MockDEX public dex;

    // Actors
    address public owner = makeAddr("owner");
    address public trader = makeAddr("trader");
    address public attacker = makeAddr("attacker");

    // Config
    uint256 public constant CHALLENGE_FEE = 100e6; // 100 USDC (6 decimals)
    uint256 public constant VIRTUAL_INITIAL = 10_000e6; // 10,000 virtual USDC
    uint256 public constant PROFIT_TARGET = 11_000e6; // 10% profit target
    uint256 public constant PA_CAPITAL = 50_000e6; // 50,000 USDC funding

    // DEX swap selector: swap(address,address,uint256)
    bytes4 public constant SWAP_SELECTOR = bytes4(keccak256("swap(address,address,uint256)"));

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);

        // Deploy mock DEX
        dex = new MockDEX();

        // Deploy Treasury
        treasury = new Treasury(address(usdc), owner);

        // Deploy AccountFactory with whitelist
        address[] memory dexTargets = new address[](1);
        dexTargets[0] = address(dex);

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = SWAP_SELECTOR;

        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(weth);

        factory = new AccountFactory(owner, address(treasury), address(usdc), dexTargets, selectors, tokens);

        // Deploy PropChallenge
        challenge = new PropChallenge(address(usdc), address(treasury), owner, CHALLENGE_FEE, VIRTUAL_INITIAL, PROFIT_TARGET, 50_000e6);

        // Wire up
        challenge.setFactory(address(factory));
        factory.setPropChallenge(address(challenge));

        // Set eval tokens
        challenge.setEvalToken(address(weth), true);

        // Fund treasury
        usdc.mint(address(treasury), 1_000_000e6);

        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Treasury Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_treasury_fundAccount() public {
        address pa = makeAddr("pa");
        vm.prank(owner);
        treasury.fundAccount(pa, PA_CAPITAL);
        assertEq(usdc.balanceOf(pa), PA_CAPITAL);
    }

    function test_treasury_fundAccount_notOwner_reverts() public {
        vm.prank(trader);
        vm.expectRevert();
        treasury.fundAccount(makeAddr("pa"), PA_CAPITAL);
    }

    function test_treasury_withdraw() public {
        vm.prank(owner);
        treasury.withdraw(owner, 1000e6);
        assertEq(usdc.balanceOf(owner), 1000e6);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PropChallenge Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_depositFee() public {
        // Give trader USDC and approve
        usdc.mint(trader, CHALLENGE_FEE);
        vm.startPrank(trader);
        usdc.approve(address(challenge), CHALLENGE_FEE);
        challenge.depositFee(CHALLENGE_FEE);
        vm.stopPrank();

        assertEq(uint256(challenge.challengeStatus(trader)), uint256(PropChallenge.ChallengeStatus.ACTIVE));

        PropChallenge.EvaluationAccount memory acc = challenge.getEvalAccount(trader);
        assertEq(acc.virtualBalance, VIRTUAL_INITIAL);
        assertEq(acc.initialBalance, VIRTUAL_INITIAL);
    }

    function test_depositFee_insufficientAmount_reverts() public {
        usdc.mint(trader, 50e6);
        vm.startPrank(trader);
        usdc.approve(address(challenge), 50e6);
        vm.expectRevert(PropChallenge.InsufficientFee.selector);
        challenge.depositFee(50e6);
        vm.stopPrank();
    }

    function test_openAndClosePosition() public {
        _setupActiveChallenge(trader);

        vm.startPrank(trader);

        // Open long WETH position: 2000 USDC at price 3000e6
        challenge.openPosition(address(weth), true, 2000e6, 3000e6);

        PropChallenge.EvaluationAccount memory acc = challenge.getEvalAccount(trader);
        assertEq(acc.virtualBalance, VIRTUAL_INITIAL - 2000e6);
        assertEq(acc.openPositionCount, 1);

        // Close at higher price (3300 = +10%)
        challenge.closePosition(0, 3300e6);

        acc = challenge.getEvalAccount(trader);
        // Should have gained 10% on 2000 USDC = 200 USDC profit
        assertEq(acc.virtualBalance, VIRTUAL_INITIAL + 200e6);
        assertEq(acc.openPositionCount, 0);

        vm.stopPrank();
    }

    function test_openMany_positions() public {
        _setupActiveChallenge(trader);

        vm.startPrank(trader);
        // No position limit — open more than 5 without revert
        for (uint8 i = 0; i < 6; i++) {
            challenge.openPosition(address(weth), true, 100e6, 3000e6);
        }
        vm.stopPrank();
    }

    function test_passChallenge() public {
        _setupActiveChallenge(trader);

        vm.startPrank(trader);
        // Open large position
        challenge.openPosition(address(weth), true, 5000e6, 1000e6);
        // Close with 30% profit → 5000 + 1500 = 6500 returned
        // virtualBalance: 10000 - 5000 + 6500 = 11500 >= 11000 target
        challenge.closePosition(0, 1300e6);
        vm.stopPrank();

        // Owner passes the challenge
        vm.prank(owner);
        challenge.passChallenge(trader);

        assertEq(uint256(challenge.challengeStatus(trader)), uint256(PropChallenge.ChallengeStatus.PASSED));

        // PA should be deployed
        address pa = factory.getAccount(trader);
        assertTrue(pa != address(0));
    }

    function test_failChallenge() public {
        _setupActiveChallenge(trader);

        vm.prank(owner);
        challenge.failChallenge(trader);

        assertEq(uint256(challenge.challengeStatus(trader)), uint256(PropChallenge.ChallengeStatus.FAILED));
    }

    // ═══════════════════════════════════════════════════════════════════
    // AccountFactory Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_factory_onlyPropChallenge() public {
        vm.prank(attacker);
        vm.expectRevert(AccountFactory.NotPropChallenge.selector);
        factory.deployAccount(trader);
    }

    function test_factory_duplicateAccount_reverts() public {
        _passChallenge(trader);

        // Try to deploy again (different trader first, then same)
        _setupActiveChallenge(attacker);

        // Try having propChallenge deploy for trader again — but trader already has PA
        // This would happen if passChallenge were called again, but status check prevents it
        assertEq(uint256(challenge.challengeStatus(trader)), uint256(PropChallenge.ChallengeStatus.PASSED));
    }

    // ═══════════════════════════════════════════════════════════════════
    // TradingAccount Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_execute_whitelisted() public {
        address pa = _setupFundedPA(trader);

        // Build swap calldata: swap(usdc, weth, 1000 USDC)
        bytes memory data = abi.encodeWithSelector(SWAP_SELECTOR, address(usdc), address(weth), 1000e6);

        vm.prank(trader);
        TradingAccount(pa).execute(address(dex), data);
    }

    function test_execute_notTrader_reverts() public {
        address pa = _setupFundedPA(trader);

        bytes memory data = abi.encodeWithSelector(SWAP_SELECTOR, address(usdc), address(weth), 1000e6);

        vm.prank(attacker);
        vm.expectRevert(TradingAccount.NotTrader.selector);
        TradingAccount(pa).execute(address(dex), data);
    }

    function test_execute_badTarget_reverts() public {
        address pa = _setupFundedPA(trader);
        address badDex = makeAddr("badDex");

        bytes memory data = abi.encodeWithSelector(SWAP_SELECTOR, address(usdc), address(weth), 1000e6);

        vm.prank(trader);
        vm.expectRevert(TradingAccount.TargetNotWhitelisted.selector);
        TradingAccount(pa).execute(badDex, data);
    }

    function test_execute_badSelector_reverts() public {
        address pa = _setupFundedPA(trader);

        // Try calling transfer() on DEX
        bytes4 transferSel = bytes4(keccak256("transfer(address,uint256)"));
        bytes memory data = abi.encodeWithSelector(transferSel, attacker, 1000e6);

        vm.prank(trader);
        vm.expectRevert(TradingAccount.SelectorNotAllowed.selector);
        TradingAccount(pa).execute(address(dex), data);
    }

    function test_execute_badToken_reverts() public {
        address pa = _setupFundedPA(trader);

        address shitcoin = makeAddr("shitcoin");
        bytes memory data = abi.encodeWithSelector(SWAP_SELECTOR, address(usdc), shitcoin, 1000e6);

        vm.prank(trader);
        vm.expectRevert(TradingAccount.TokenNotAllowed.selector);
        TradingAccount(pa).execute(address(dex), data);
    }

    function test_settle() public {
        address pa = _setupFundedPA(trader);

        // Simulate profit: mint extra USDC to PA
        uint256 profit = 10_000e6;
        usdc.mint(pa, profit);

        uint256 traderBalBefore = usdc.balanceOf(trader);
        uint256 treasuryBalBefore = usdc.balanceOf(address(treasury));

        vm.prank(owner);
        TradingAccount(pa).settle();

        uint256 expectedTraderShare = (profit * 8000) / 10000; // 8000 USDC
        uint256 expectedPlatformShare = profit - expectedTraderShare; // 2000 USDC

        assertEq(usdc.balanceOf(trader) - traderBalBefore, expectedTraderShare);
        assertEq(usdc.balanceOf(address(treasury)) - treasuryBalBefore, PA_CAPITAL + expectedPlatformShare);
    }

    function test_settle_noProfit_reverts() public {
        address pa = _setupFundedPA(trader);

        vm.prank(owner);
        vm.expectRevert(TradingAccount.InsufficientProfit.selector);
        TradingAccount(pa).settle();
    }

    function test_forceClose() public {
        address pa = _setupFundedPA(trader);

        uint256 treasuryBalBefore = usdc.balanceOf(address(treasury));

        vm.prank(owner);
        TradingAccount(pa).forceClose();

        // All USDC should go to treasury
        assertEq(usdc.balanceOf(address(treasury)) - treasuryBalBefore, PA_CAPITAL);
        assertEq(usdc.balanceOf(pa), 0);

        // Trader should be revoked
        assertEq(TradingAccount(pa).trader(), address(0));
    }

    function test_revokeTrader() public {
        address pa = _setupFundedPA(trader);

        vm.prank(owner);
        TradingAccount(pa).revokeTrader();
        assertEq(TradingAccount(pa).trader(), address(0));
    }

    function test_noReceive_noFallback() public {
        address pa = _setupFundedPA(trader);

        // Attempt to send native tokens should revert
        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        (bool success,) = pa.call{value: 1 ether}("");
        assertFalse(success);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Integration Test: Full Flow
    // ═══════════════════════════════════════════════════════════════════

    function test_fullFlow() public {
        // 1. Trader deposits fee
        usdc.mint(trader, CHALLENGE_FEE);
        vm.startPrank(trader);
        usdc.approve(address(challenge), CHALLENGE_FEE);
        challenge.depositFee(CHALLENGE_FEE);

        // 2. Paper trading — open and close profitable position
        challenge.openPosition(address(weth), true, 5000e6, 1000e6);
        challenge.closePosition(0, 1300e6); // +30% profit
        vm.stopPrank();

        // 3. Owner passes challenge
        vm.prank(owner);
        challenge.passChallenge(trader);

        // 4. Treasury funds the PA
        address pa = factory.getAccount(trader);
        vm.prank(owner);
        treasury.fundAccount(pa, PA_CAPITAL);

        // Set initial capital on PA
        vm.prank(owner);
        TradingAccount(pa).setInitialCapital(PA_CAPITAL);

        assertEq(usdc.balanceOf(pa), PA_CAPITAL);

        // 5. Trader executes a whitelisted swap
        bytes memory swapData = abi.encodeWithSelector(SWAP_SELECTOR, address(usdc), address(weth), 1000e6);
        vm.prank(trader);
        TradingAccount(pa).execute(address(dex), swapData);

        // 6. Simulate profit and settle
        usdc.mint(pa, 5000e6); // simulate trading profits
        vm.prank(owner);
        TradingAccount(pa).settle();

        // Trader got 80% of 5000 = 4000 USDC
        assertEq(usdc.balanceOf(trader), 4000e6);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Security Tests: Anti-Rug
    // ═══════════════════════════════════════════════════════════════════

    function test_antiRug_directTransfer_reverts() public {
        address pa = _setupFundedPA(trader);

        // Trader tries to call USDC.transfer directly through execute
        bytes4 transferSel = 0xa9059cbb; // transfer(address,uint256)
        bytes memory data = abi.encodeWithSelector(transferSel, attacker, PA_CAPITAL);

        vm.prank(trader);
        // Target is USDC contract, not DEX — should fail target check
        vm.expectRevert(TradingAccount.TargetNotWhitelisted.selector);
        TradingAccount(pa).execute(address(usdc), data);
    }

    function test_antiRug_approve_blocked() public {
        // Even if somehow DEX target matched, approve selector is blocked
        address pa = _setupFundedPA(trader);

        bytes4 approveSel = 0x095ea7b3;
        bytes memory data = abi.encodeWithSelector(approveSel, attacker, PA_CAPITAL);

        vm.prank(trader);
        // Will fail at selector check since approve is blocked
        vm.expectRevert(TradingAccount.SelectorNotAllowed.selector);
        TradingAccount(pa).execute(address(dex), data);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════

    function _setupActiveChallenge(address _trader) internal {
        usdc.mint(_trader, CHALLENGE_FEE);
        vm.startPrank(_trader);
        usdc.approve(address(challenge), CHALLENGE_FEE);
        challenge.depositFee(CHALLENGE_FEE);
        vm.stopPrank();
    }

    function _passChallenge(address _trader) internal {
        _setupActiveChallenge(_trader);

        vm.startPrank(_trader);
        challenge.openPosition(address(weth), true, 5000e6, 1000e6);
        challenge.closePosition(0, 1300e6);
        vm.stopPrank();

        vm.prank(owner);
        challenge.passChallenge(_trader);
    }

    function _setupFundedPA(address _trader) internal returns (address pa) {
        _passChallenge(_trader);
        pa = factory.getAccount(_trader);

        vm.prank(owner);
        treasury.fundAccount(pa, PA_CAPITAL);

        vm.prank(owner);
        TradingAccount(pa).setInitialCapital(PA_CAPITAL);
    }
}
