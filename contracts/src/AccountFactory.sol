// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TradingAccount} from "./TradingAccount.sol";

/// @title AccountFactory
/// @notice Deploys and registers TradingAccount (PA) instances with whitelist config.
contract AccountFactory is Ownable {
    // ── Errors ──────────────────────────────────────────────────────────
    error NotPropChallenge();
    error ZeroAddress();

    // ── Events ──────────────────────────────────────────────────────────
    event AccountDeployed(address indexed trader, address indexed account);
    event WhitelistUpdated();
    event AccountRemoved(address indexed trader, address indexed account);

    // ── State ───────────────────────────────────────────────────────────
    mapping(address => address) public traderToPA;
    mapping(address => address) public paToTrader;
    mapping(address => bool) public isActivePA;
    address[] public allPAs;

    address public propChallenge;
    address public treasury;
    address public usdc;
    uint256 public deployNonce;

    // Whitelist config injected into each new PA
    address[] public allowedDexTargets;
    bytes4[] public allowedSelectors;
    address[] public allowedTokens;

    constructor(
        address _owner,
        address _treasury,
        address _usdc,
        address[] memory _dexTargets,
        bytes4[] memory _selectors,
        address[] memory _tokens
    ) Ownable(_owner) {
        if (_treasury == address(0) || _usdc == address(0)) revert ZeroAddress();
        treasury = _treasury;
        usdc = _usdc;
        allowedDexTargets = _dexTargets;
        allowedSelectors = _selectors;
        allowedTokens = _tokens;
    }

    /// @notice Set the PropChallenge contract address.
    function setPropChallenge(address _propChallenge) external onlyOwner {
        if (_propChallenge == address(0)) revert ZeroAddress();
        propChallenge = _propChallenge;
    }

    /// @notice Deploy a new TradingAccount for a trader. Only callable by PropChallenge.
    /// @param trader The trader address who passed the challenge.
    /// @return account The deployed TradingAccount address.
    function deployAccount(address trader) external returns (address account) {
        if (msg.sender != propChallenge) revert NotPropChallenge();
        if (propChallenge == address(0)) revert ZeroAddress();

        // Use CREATE2 with an ever-increasing salt so each deployment address differs per call.
        // Set the TradingAccount owner to PropChallenge so it can setInitialCapital/funding flows.
        TradingAccount pa = new TradingAccount{salt: bytes32(++deployNonce)}(
            owner(),        // platform admin (forceClose/liquidate)
            propChallenge,  // challenger (setInitialCapital)
            trader, treasury, usdc, allowedDexTargets, allowedSelectors, allowedTokens
        );

        account = address(pa);
        traderToPA[trader] = account;
        paToTrader[account] = trader;
        isActivePA[account] = true;
        allPAs.push(account);

        emit AccountDeployed(trader, account);
    }

    // ── Views ───────────────────────────────────────────────────────────
    /// @notice Get PA address for a trader.
    function getAccount(address trader) external view returns (address) {
        return traderToPA[trader];
    }

    /// @notice Get all deployed PA addresses.
    function getAllAccounts() external view returns (address[] memory) {
        return allPAs;
    }

    /// @notice Get all active PA addresses (filters out deactivated ones).
    function getAllActiveAccounts() external view returns (address[] memory) {
        uint256 len = allPAs.length;
        uint256 activeCount;
        for (uint256 i = 0; i < len; i++) {
            if (isActivePA[allPAs[i]]) activeCount++;
        }

        address[] memory res = new address[](activeCount);
        uint256 idx;
        for (uint256 i = 0; i < len; i++) {
            address pa = allPAs[i];
            if (isActivePA[pa]) res[idx++] = pa;
        }
        return res;
    }

    /// @notice Get count of deployed PAs.
    function getAccountCount() external view returns (uint256) {
        return allPAs.length;
    }

    // ── Admin ───────────────────────────────────────────────────────────
    /// @notice Update whitelist config for future deployments.
    function updateWhitelist(
        address[] calldata _dexTargets,
        bytes4[] calldata _selectors,
        address[] calldata _tokens
    ) external onlyOwner {
        allowedDexTargets = _dexTargets;
        allowedSelectors = _selectors;
        allowedTokens = _tokens;
        emit WhitelistUpdated();
    }

    /// @notice Deactivate a PA so monitors can ignore it; clears trader mapping if pointing to this PA.
    function deactivateAccount(address account) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();
        if (!isActivePA[account]) return; // already inactive, no-op

        isActivePA[account] = false;
        address trader = paToTrader[account];
        if (traderToPA[trader] == account) {
            traderToPA[trader] = address(0);
        }
        emit AccountRemoved(trader, account);
    }
}
