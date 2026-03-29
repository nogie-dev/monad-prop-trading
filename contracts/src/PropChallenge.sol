// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAccountFactory {
    function deployAccount(address trader) external returns (address);
}

interface ITreasury {
    function fundAccount(address pa, uint256 amount) external;
}

interface ITradingAccount {
    function setInitialCapital(uint256 amount) external;
}

/// @title PropChallenge
/// @notice Manages challenge fee collection, paper trading evaluation, and pass/fail state.
contract PropChallenge is Ownable, ReentrancyGuard {
    // ── Errors ──────────────────────────────────────────────────────────
    error InvalidStatus();
    error InsufficientFee();
    error PositionNotOpen();
    error InvalidPositionIndex();
    error InsufficientVirtualBalance();
    error TargetNotMet();
    error ZeroAddress();
    error ZeroAmount();
    error TokenNotAllowed();

    // ── Events ──────────────────────────────────────────────────────────
    event FeeDeposited(address indexed trader, uint256 amount);
    event PositionOpened(address indexed trader, uint256 positionIndex, address token, bool isLong, uint256 size);
    event PositionClosed(address indexed trader, uint256 positionIndex, int256 pnl);
    event ChallengePassed(address indexed trader, address pa);
    event ChallengeFailed(address indexed trader);

    // ── Types ───────────────────────────────────────────────────────────
    enum ChallengeStatus {
        NONE,
        ACTIVE,
        PASSED,
        FAILED
    }

    struct EvaluationAccount {
        uint256 virtualBalance;
        uint256 initialBalance;
        uint256 realizedPnL;
        bool paActivated;
        uint8 openPositionCount;
    }

    struct Position {
        address token;
        bool isLong;
        uint256 size;
        uint256 entryPrice;
        uint256 timestamp;
        bool isOpen;
    }

    // ── State ───────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    IAccountFactory public factory;
    address public treasury;

    uint256 public challengeFee;
    uint256 public virtualInitialBalance;
    uint256 public profitTarget; // Minimum virtualBalance to pass
    uint256 public paFundingAmount; // Real USDC to fund PA upon pass

    mapping(address => ChallengeStatus) public challengeStatus;
    mapping(address => EvaluationAccount) public evalAccounts;
    mapping(address => Position[]) internal _positions;

    // Allowed tokens for paper trading
    mapping(address => bool) public allowedEvalTokens;

    constructor(
        address _usdc,
        address _treasury,
        address _owner,
        uint256 _challengeFee,
        uint256 _virtualInitialBalance,
        uint256 _profitTarget
    ) Ownable(_owner) {
        if (_usdc == address(0) || _treasury == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        treasury = _treasury;
        challengeFee = _challengeFee;
        virtualInitialBalance = _virtualInitialBalance;
        profitTarget = _profitTarget;
    }

    // ── Admin ───────────────────────────────────────────────────────────
    /// @notice Set the AccountFactory address.
    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert ZeroAddress();
        factory = IAccountFactory(_factory);
    }

    /// @notice Set allowed tokens for paper trading evaluation.
    function setEvalToken(address token, bool allowed) external onlyOwner {
        allowedEvalTokens[token] = allowed;
    }

    /// @notice Update challenge parameters.
    function updateParams(uint256 _fee, uint256 _initialBalance, uint256 _target) external onlyOwner {
        challengeFee = _fee;
        virtualInitialBalance = _initialBalance;
        profitTarget = _target;
    }

    /// @notice Set real USDC funding amount for newly deployed PAs.
    function setPaFundingAmount(uint256 amount) external onlyOwner {
        paFundingAmount = amount;
    }

    // ── Debugging (Owner Only) ──────────────────────────────────────────
    /// @notice Manually increase a trader's virtual balance. For debugging only.
    function increaseVirtualBalance(address trader, uint256 amount) external onlyOwner {
        if (trader == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (challengeStatus[trader] == ChallengeStatus.NONE) revert InvalidStatus();

        evalAccounts[trader].virtualBalance += amount;
    }

    /// @notice Manually decrease a trader's virtual balance. For debugging only.
    function decreaseVirtualBalance(address trader, uint256 amount) external onlyOwner {
        if (trader == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (challengeStatus[trader] == ChallengeStatus.NONE) revert InvalidStatus();

        EvaluationAccount storage acc = evalAccounts[trader];
        if (acc.virtualBalance < amount) revert InsufficientVirtualBalance();
        acc.virtualBalance -= amount;
    }

    // ── Challenge Entry ─────────────────────────────────────────────────
    /// @notice Deposit USDC fee to start a challenge. Fee is non-refundable.
    /// @param amount USDC amount (must equal challengeFee).
    function depositFee(uint256 amount) external nonReentrant {
        if (challengeStatus[msg.sender] == ChallengeStatus.ACTIVE) revert InvalidStatus();
        if (amount < challengeFee) revert InsufficientFee();

        // Transfer fee from trader to treasury
        usdc.transferFrom(msg.sender, treasury, amount);

        // Initialize challenge
        challengeStatus[msg.sender] = ChallengeStatus.ACTIVE;
        evalAccounts[msg.sender] = EvaluationAccount({
            virtualBalance: virtualInitialBalance,
            initialBalance: virtualInitialBalance,
            realizedPnL: 0,
            paActivated: false,
            openPositionCount: 0
        });

        // Clear any previous positions
        delete _positions[msg.sender];

        emit FeeDeposited(msg.sender, amount);
    }

    // ── Paper Trading ───────────────────────────────────────────────────
    /// @notice Open a paper trading position.
    /// @param token Token to trade (e.g., WETH, WBTC).
    /// @param isLong True for long, false for short.
    /// @param size Position size in virtual USDC.
    /// @param price Oracle price passed by frontend (18 decimals).
    function openPosition(address token, bool isLong, uint256 size, uint256 price) external {
        if (challengeStatus[msg.sender] != ChallengeStatus.ACTIVE) revert InvalidStatus();
        if (!allowedEvalTokens[token]) revert TokenNotAllowed();

        EvaluationAccount storage acc = evalAccounts[msg.sender];
        if (size > acc.virtualBalance) revert InsufficientVirtualBalance();

        acc.virtualBalance -= size;
        acc.openPositionCount++;

        _positions[msg.sender].push(
            Position({token: token, isLong: isLong, size: size, entryPrice: price, timestamp: block.timestamp, isOpen: true})
        );

        emit PositionOpened(msg.sender, _positions[msg.sender].length - 1, token, isLong, size);
    }

    /// @notice Close a paper trading position.
    /// @param positionIndex Index in the trader's position array.
    /// @param exitPrice Oracle price at close (18 decimals).
    function closePosition(uint256 positionIndex, uint256 exitPrice) external {
        if (challengeStatus[msg.sender] != ChallengeStatus.ACTIVE) revert InvalidStatus();

        Position[] storage positions = _positions[msg.sender];
        if (positionIndex >= positions.length) revert InvalidPositionIndex();

        Position storage pos = positions[positionIndex];
        if (!pos.isOpen) revert PositionNotOpen();

        // Calculate P&L
        int256 pnl;
        if (pos.isLong) {
            // Long: profit when price goes up
            pnl = int256((pos.size * exitPrice) / pos.entryPrice) - int256(pos.size);
        } else {
            // Short: profit when price goes down
            pnl = int256(pos.size) - int256((pos.size * exitPrice) / pos.entryPrice);
        }

        // Update account
        EvaluationAccount storage acc = evalAccounts[msg.sender];
        if (pnl >= 0) {
            acc.virtualBalance += pos.size + uint256(pnl);
            acc.realizedPnL += uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            uint256 returned = pos.size > loss ? pos.size - loss : 0;
            acc.virtualBalance += returned;
            // realizedPnL stays as cumulative gains only for simplicity
        }

        pos.isOpen = false;
        acc.openPositionCount--;

        emit PositionClosed(msg.sender, positionIndex, pnl);
    }

    // ── Pass / Fail ─────────────────────────────────────────────────────
    /// @notice Pass a trader's challenge and deploy their PA.
    /// @param trader The trader who passed.
    function passChallenge(address trader) external {
        if (challengeStatus[trader] != ChallengeStatus.ACTIVE) revert InvalidStatus();

        EvaluationAccount storage acc = evalAccounts[trader];
        if (acc.virtualBalance < profitTarget) revert TargetNotMet();

        challengeStatus[trader] = ChallengeStatus.PASSED;
        acc.paActivated = true;

        // Deploy PA via factory
        address pa = factory.deployAccount(trader);

        // Fund PA and set its initial capital if configured
        if (paFundingAmount > 0) {
            ITreasury(treasury).fundAccount(pa, paFundingAmount);
            ITradingAccount(pa).setInitialCapital(paFundingAmount);
        }

        emit ChallengePassed(trader, pa);
    }

    /// @notice Fail a trader's challenge.
    /// @param trader The trader who failed.
    function failChallenge(address trader) external onlyOwner {
        if (challengeStatus[trader] != ChallengeStatus.ACTIVE) revert InvalidStatus();
        challengeStatus[trader] = ChallengeStatus.FAILED;
        emit ChallengeFailed(trader);
    }

    // ── Views ───────────────────────────────────────────────────────────
    /// @notice Get challenge status for a trader.
    function getStatus(address trader) external view returns (ChallengeStatus) {
        return challengeStatus[trader];
    }

    /// @notice Get evaluation account data.
    function getEvalAccount(address trader) external view returns (EvaluationAccount memory) {
        return evalAccounts[trader];
    }

    /// @notice Get all positions for a trader.
    function getPositions(address trader) external view returns (Position[] memory) {
        return _positions[trader];
    }

    /// @notice Get a specific position.
    function getPosition(address trader, uint256 index) external view returns (Position memory) {
        return _positions[trader][index];
    }
}
