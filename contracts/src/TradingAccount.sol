// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title TradingAccount (Performance Account)
/// @notice Custom Smart Account holding USDC. Trader has execute() permission only.
/// @dev NOT ERC-4337. Platform owns the account; trader can only call whitelisted DEX functions.
contract TradingAccount is ReentrancyGuard, AccessControl {
    // ── Errors ──────────────────────────────────────────────────────────
    error NotOwner();
    error NotTrader();
    error TraderAlreadyRevoked();
    error TargetNotWhitelisted();
    error SelectorNotAllowed();
    error TokenNotAllowed();
    error ExecutionFailed();
    error InsufficientProfit();
    error NoFundsToClose();

    // ── Events ──────────────────────────────────────────────────────────
    event Executed(address indexed target, bytes4 indexed selector, bool success);
    event Settled(address indexed trader, uint256 traderShare, uint256 platformShare);
    event ForceClosed(address indexed trader, uint256 amountReturned);
    event TraderRevoked(address indexed trader);
    event Liquidated(address indexed trader, uint256 usdcReturned);
    event LiquidationSwapFailed(address indexed token, uint256 amount);

    // ── State ───────────────────────────────────────────────────────────
    address public owner;
    address public trader;
    address public treasury;
    address public usdc;
    address public challenger; // PropChallenge — can call setInitialCapital
    uint256 public initialCapital;
    bool public isLiquidated; // set to true when liquidate() is called (drawdown)

    mapping(address => bool) public allowedTargets;
    mapping(bytes4 => bool) public allowedSelectors;
    mapping(address => bool) public allowedTokens;

    address[] private _tokenList; // for iterating during forceClose

    // ── Constants ───────────────────────────────────────────────────────
    uint256 public constant TRADER_SHARE_BPS = 8000; // 80%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ── Blocked selectors (never add these to whitelist) ────────────────
    bytes4 private constant TRANSFER_SELECTOR = 0xa9059cbb;
    bytes4 private constant APPROVE_SELECTOR = 0x095ea7b3;
    bytes4 private constant TRANSFER_FROM_SELECTOR = 0x23b872dd;

    // swapExactIn(address,address,uint256,uint256,address) = 0x7b32b50e
    bytes4 private constant SWAP_EXACT_IN = bytes4(keccak256("swapExactIn(address,address,uint256,uint256,address)"));

    // ── Constructor ─────────────────────────────────────────────────────
    constructor(
        address _admin,      // platform owner — can forceClose/liquidate/revokeTrader
        address _challenger, // PropChallenge — can call setInitialCapital
        address _trader,
        address _treasury,
        address _usdc,
        address[] memory _allowedTargets,
        bytes4[] memory _allowedSelectors,
        address[] memory _allowedTokens
    ) {
        owner = _admin;
        trader = _trader;
        treasury = _treasury;
        usdc = _usdc;
        challenger = _challenger;

        // Roles: admin = platform owner, trader = PA trader
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(keccak256("ADMIN_ROLE"), _admin);
        if (_trader != address(0)) {
            _grantRole(keccak256("TRADER_ROLE"), _trader);
        }

        for (uint256 i = 0; i < _allowedTargets.length; i++) {
            allowedTargets[_allowedTargets[i]] = true;
        }

        for (uint256 i = 0; i < _allowedSelectors.length; i++) {
            // Safety: never allow transfer/approve/transferFrom
            bytes4 sel = _allowedSelectors[i];
            if (sel == TRANSFER_SELECTOR || sel == APPROVE_SELECTOR || sel == TRANSFER_FROM_SELECTOR) {
                continue;
            }
            allowedSelectors[sel] = true;
        }

        for (uint256 i = 0; i < _allowedTokens.length; i++) {
            allowedTokens[_allowedTokens[i]] = true;
            _tokenList.push(_allowedTokens[i]);
        }

        // Pre-approve all allowed DEX targets to spend all allowed tokens.
        // Required because execute() blocks approve() calls, but the router
        // needs allowance to pull tokens from this PA via safeTransferFrom.
        for (uint256 i = 0; i < _allowedTokens.length; i++) {
            for (uint256 j = 0; j < _allowedTargets.length; j++) {
                IERC20(_allowedTokens[i]).approve(_allowedTargets[j], type(uint256).max);
            }
        }
    }

    // ── Modifiers ───────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (!hasRole(keccak256("ADMIN_ROLE"), msg.sender)) revert NotOwner();
        _;
    }

    modifier onlyTrader() {
        if (!hasRole(keccak256("TRADER_ROLE"), msg.sender)) revert NotTrader();
        if (trader == address(0)) revert TraderAlreadyRevoked();
        _;
    }

    // ── Core: execute() ─────────────────────────────────────────────────
    /// @notice Execute a whitelisted call on behalf of the PA.
    /// @param target The DEX router address.
    /// @param data The calldata (selector + params).
    function execute(address target, bytes calldata data) external onlyTrader nonReentrant {
        // 라우터 주소 검증
        if (!allowedTargets[target]) revert TargetNotWhitelisted();

        // whitelist 함수 검증
        bytes4 selector = bytes4(data[:4]);
        if (!allowedSelectors[selector]) revert SelectorNotAllowed();

        // 거래 대상 토큰 검증
        _validateTokens(data);

        (bool success,) = target.call(data);
        if (!success) revert ExecutionFailed();

        emit Executed(target, selector, success);
    }

    // ── Settlement ──────────────────────────────────────────────────────
    /// @notice Settle profits: 80% to trader, 20% to treasury.
    /// @dev Callable by owner or trader; withdraws profit only (initial capital stays).
    function settle() external nonReentrant {
        if (msg.sender != owner && msg.sender != trader) revert NotOwner();
        uint256 currentValue = getPortfolioValue();
        if (currentValue <= initialCapital) revert InsufficientProfit();

        uint256 profit = currentValue - initialCapital;
        uint256 traderShare = (profit * TRADER_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 platformShare = profit - traderShare;

        // Withdraw only profit: platform share to treasury, trader share to trader.
        IERC20(usdc).transfer(treasury, platformShare);
        IERC20(usdc).transfer(trader, traderShare);

        emit Settled(trader, traderShare, platformShare);
    }

    /// @notice Force liquidate: swap all non-USDC tokens to USDC via DEX, then return all to treasury.
    /// @dev onlyOwner. Leaves 1 wei dust per non-USDC token to avoid zero-balance reverts.
    ///      Swap failures are tolerated (emits LiquidationSwapFailed) so liquidation always completes.
    /// @param dexTarget Whitelisted DEX router to use for swaps.
    function liquidate(address dexTarget) external onlyOwner nonReentrant {
        if (!allowedTargets[dexTarget]) revert TargetNotWhitelisted();

        // Swap each non-USDC token to USDC (best-effort, 0 minAmountOut)
        for (uint256 i = 0; i < _tokenList.length; i++) {
            address token = _tokenList[i];
            if (token == usdc) continue;

            uint256 bal = IERC20(token).balanceOf(address(this));
            if (bal <= 1) continue; // leave 1 wei dust

            bytes memory data = abi.encodeWithSelector(
                SWAP_EXACT_IN,
                token,
                usdc,
                bal - 1, // leave 1 wei dust
                0,       // minAmountOut = 0: accept any price, liquidation is forced
                address(this)
            );
            (bool ok,) = dexTarget.call(data);
            if (!ok) emit LiquidationSwapFailed(token, bal - 1);
        }

        uint256 usdcBal = IERC20(usdc).balanceOf(address(this));
        if (usdcBal > 0) IERC20(usdc).transfer(treasury, usdcBal);

        address _trader = trader;
        isLiquidated = true;
        _revokeTrader();
        emit Liquidated(_trader, usdcBal);
    }

    /// @notice Force close: transfer all USDC to treasury and revoke trader.
    /// @dev Use liquidate() instead if PA holds non-USDC tokens.
    function forceClose() external onlyOwner nonReentrant {
        uint256 usdcBalance = IERC20(usdc).balanceOf(address(this));
        if (usdcBalance == 0) revert NoFundsToClose();

        IERC20(usdc).transfer(treasury, usdcBalance);
        emit ForceClosed(trader, usdcBalance);
        _revokeTrader();
    }

    /// @notice Revoke trader access.
    function revokeTrader() external onlyOwner {
        _revokeTrader();
    }

    // ── Views ───────────────────────────────────────────────────────────
    /// @notice Get total portfolio value in USDC terms.
    /// @dev MVP: returns USDC balance only. Production would add token valuations.
    function getPortfolioValue() public view returns (uint256) {
        return IERC20(usdc).balanceOf(address(this));
    }

    /// @notice Set initial capital (called once when Treasury funds the account).
    function setInitialCapital(uint256 amount) external {
        if (!hasRole(keccak256("ADMIN_ROLE"), msg.sender) && msg.sender != challenger) revert NotOwner();
        initialCapital = amount;
    }

    /// @notice Admin can update trader (replaces role and address).
    function setTrader(address newTrader) external onlyOwner {
        _revokeTrader();
        trader = newTrader;
        if (newTrader != address(0)) {
            _grantRole(keccak256("TRADER_ROLE"), newTrader);
        }
    }

    // ── Internal ────────────────────────────────────────────────────────
    /// @dev Validate that tokens in swap calldata are whitelisted.
    ///      Decodes common DEX swap signatures: (tokenIn, tokenOut, ...) or path-based.
    function _validateTokens(bytes calldata data) internal view {
        // For standard swap functions, tokenIn and tokenOut are typically
        // the first two address params after the selector.
        // We check addresses at known offsets in the calldata.
        if (data.length >= 68) {
            // Decode first two address params (offset 4 and 36)
            address tokenIn = address(uint160(uint256(bytes32(data[4:36]))));
            address tokenOut = address(uint160(uint256(bytes32(data[36:68]))));

            if (!allowedTokens[tokenIn]) revert TokenNotAllowed();
            if (!allowedTokens[tokenOut]) revert TokenNotAllowed();
        }
    }

    function _revokeTrader() internal {
        address oldTrader = trader;
        trader = address(0);
        if (oldTrader != address(0)) {
            _revokeRole(keccak256("TRADER_ROLE"), oldTrader);
        }
        emit TraderRevoked(oldTrader);
    }

    // ── Blocked ─────────────────────────────────────────────────────────
    // No receive, no fallback — cannot accept native tokens
}
