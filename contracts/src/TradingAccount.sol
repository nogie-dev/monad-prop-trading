// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TradingAccount (Performance Account)
/// @notice Custom Smart Account holding USDC. Trader has execute() permission only.
/// @dev NOT ERC-4337. Platform owns the account; trader can only call whitelisted DEX functions.
contract TradingAccount is ReentrancyGuard {
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

    // ── State ───────────────────────────────────────────────────────────
    address public owner;
    address public trader;
    address public treasury;
    address public usdc;
    uint256 public initialCapital;

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

    // ── Constructor ─────────────────────────────────────────────────────
    constructor(
        address _owner,
        address _trader,
        address _treasury,
        address _usdc,
        address[] memory _allowedTargets,
        bytes4[] memory _allowedSelectors,
        address[] memory _allowedTokens
    ) {
        owner = _owner;
        trader = _trader;
        treasury = _treasury;
        usdc = _usdc;

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
    }

    // ── Modifiers ───────────────────────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyTrader() {
        if (msg.sender != trader) revert NotTrader();
        if (trader == address(0)) revert TraderAlreadyRevoked();
        _;
    }

    // ── Core: execute() ─────────────────────────────────────────────────
    /// @notice Execute a whitelisted call on behalf of the PA.
    /// @param target The DEX router address.
    /// @param data The calldata (selector + params).
    function execute(address target, bytes calldata data) external onlyTrader nonReentrant {
        if (!allowedTargets[target]) revert TargetNotWhitelisted();

        bytes4 selector = bytes4(data[:4]);
        if (!allowedSelectors[selector]) revert SelectorNotAllowed();

        _validateTokens(data);

        (bool success,) = target.call(data);
        if (!success) revert ExecutionFailed();

        emit Executed(target, selector, success);
    }

    // ── Settlement ──────────────────────────────────────────────────────
    /// @notice Settle profits: 80% to trader, 20% to treasury.
    function settle() external onlyOwner nonReentrant {
        uint256 currentValue = getPortfolioValue();
        if (currentValue <= initialCapital) revert InsufficientProfit();

        uint256 profit = currentValue - initialCapital;
        uint256 traderShare = (profit * TRADER_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 platformShare = profit - traderShare;

        // Return initial capital + platform share to treasury
        IERC20(usdc).transfer(treasury, initialCapital + platformShare);
        // Send trader share
        IERC20(usdc).transfer(trader, traderShare);

        emit Settled(trader, traderShare, platformShare);
    }

    /// @notice Force close: swap all tokens back to USDC and return to treasury.
    function forceClose() external onlyOwner nonReentrant {
        // NOTE: In production, would swap non-USDC tokens via DEX here.
        // For MVP, assume all value is already in USDC.
        uint256 usdcBalance = IERC20(usdc).balanceOf(address(this));
        if (usdcBalance == 0) revert NoFundsToClose();

        IERC20(usdc).transfer(treasury, usdcBalance);

        emit ForceClosed(trader, usdcBalance);

        // Revoke trader access
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
    function setInitialCapital(uint256 amount) external onlyOwner {
        initialCapital = amount;
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
        emit TraderRevoked(oldTrader);
    }

    // ── Blocked ─────────────────────────────────────────────────────────
    // No receive, no fallback — cannot accept native tokens
}
