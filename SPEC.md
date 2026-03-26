# SPEC: On-Chain Prop Trading Platform

## 1. Overview

On-chain prop trading platform on Monad. Replicates the traditional Prop Firm model (FTMO, etc.) with trustless, contract-enforced fund management.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Challenge fee currency | USDC (stablecoin) | No volatility risk on fee collection |
| PA operating capital | USDC (stablecoin) | Stable base for P&L calculation |
| Evaluation method | On-chain position recording + off-chain oracle price | Verifiable on-chain, flexible evaluation logic |
| PA architecture | Custom Smart Account | Lightweight, no Bundler/EntryPoint needed (not ERC-4337) |
| Trading pairs | USDC ↔ WBTC, USDC ↔ WETH + blue chips | Token whitelist prevents meme/micro-cap |
| Profit split | 80% trader / 20% platform | Industry standard |

---

## 2. Core User Flow

```
Step 1: Fee Deposit (on-chain)
  → Trader deposits USDC to PropChallenge. Non-refundable. Fee → Treasury.

Step 2: Paper Trading Evaluation (on-chain recording + off-chain price)
  → Frontend provides simulated trading using oracle prices.
  → Each position open/close is recorded in PropChallenge contract storage.
  → Virtual balance tracked per trader in contract.

Step 3: Pass Judgment (on-chain)
  → Team EOA calls PropChallenge.passChallenge(trader) on target met.
  → Triggers AccountFactory.deployAccount(trader).

Step 4: PA Funded (on-chain)
  → Treasury transfers USDC operating capital to new TradingAccount (PA).

Step 5: Live DEX Trading (on-chain)
  → Trader calls PA.execute() to swap on whitelisted DEX.
  → Target, selector, token all validated.

Step 6: Settlement / Liquidation (on-chain)
  → Profit > threshold: settle() → 80% trader, 20% Treasury.
  → Drawdown > limit: forceClose() → all funds → Treasury, PA revoked.
```

---

## 3. Smart Contract Architecture

### 3.1 PropChallenge

Manages challenge fee collection, paper trading evaluation storage, and pass/fail state.

**State:**
```solidity
enum ChallengeStatus { NONE, ACTIVE, PASSED, FAILED }

struct EvaluationAccount {
    uint256 virtualBalance;     // Current virtual USDC balance
    uint256 initialBalance;     // Starting virtual balance (e.g., 10,000 USDC)
    uint256 realizedPnL;        // Cumulative realized P&L
    bool paActivated;           // PA activation flag
    uint8 openPositionCount;    // Current open positions (max 5)
}

struct Position {
    address token;              // e.g., WETH, WBTC
    bool isLong;
    uint256 size;               // In virtual USDC
    uint256 entryPrice;         // Oracle price at open
    uint256 timestamp;
    bool isOpen;
}

mapping(address => ChallengeStatus) public challengeStatus;
mapping(address => EvaluationAccount) public evalAccounts;
mapping(address => Position[]) public positions;
```

**Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `depositFee(uint256 amount)` | Public | Transfer USDC fee via approve+transferFrom. Set status=ACTIVE. Init EvaluationAccount. Forward fee to Treasury. |
| `openPosition(address token, bool isLong, uint256 size, uint256 price)` | ACTIVE traders | Record paper trade position. Deduct from virtualBalance. price = oracle value passed by frontend. |
| `closePosition(uint256 positionIndex, uint256 exitPrice)` | ACTIVE traders | Calculate P&L, update virtualBalance and realizedPnL. Mark position closed. |
| `passChallenge(address trader)` | Owner only | Require virtualBalance >= target. Set status=PASSED. Call AccountFactory.deployAccount(). |
| `failChallenge(address trader)` | Owner only | Set status=FAILED. No refund. |
| `getStatus(address trader)` | View | Return ChallengeStatus. |
| `getEvalAccount(address trader)` | View | Return EvaluationAccount data. |

**Note on price data:** For hackathon, frontend passes oracle price as calldata. Security concern (trader can fake price) acknowledged but deferred. Production would use Chainlink oracle or DEX TWAP for on-chain verification.

---

### 3.2 AccountFactory

Deploys and registers TradingAccount (PA) instances.

**State:**
```solidity
mapping(address => address) public traderToPA;  // trader → PA address
address[] public allPAs;                         // registry

// Whitelist config (injected into each PA)
address[] public allowedDexTargets;
bytes4[] public allowedSelectors;
address[] public allowedTokens;
```

**Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `deployAccount(address trader)` | PropChallenge only | Deploy new TradingAccount with trader, whitelist config. Register in mapping. |
| `getAccount(address trader)` | View | Return PA address for trader. |
| `getAllAccounts()` | View | Return all PA addresses. |
| `updateWhitelist(...)` | Owner only | Update DEX/selector/token whitelist for future deployments. |

---

### 3.3 TradingAccount (PA) — Core Contract

Custom Smart Account holding USDC. Trader has execute() permission only.

**State:**
```solidity
address public owner;           // Platform (deployer/factory)
address public trader;          // Authorized executor
uint256 public initialCapital;  // USDC deposited by Treasury at creation

mapping(address => bool) public allowedTargets;    // DEX router addresses
mapping(bytes4 => bool) public allowedSelectors;   // swap function selectors
mapping(address => bool) public allowedTokens;     // USDC, WBTC, WETH, etc.
```

**Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `execute(address target, bytes calldata data)` | Trader only | Validate target ∈ allowedTargets, selector ∈ allowedSelectors, decode swap params to verify tokens ∈ allowedTokens. Then `target.call(data)`. |
| `getPortfolioValue()` | View | USDC balance + Σ(token balance × DEX spot price). |
| `settle()` | Owner only | Require portfolioValue > initialCapital + minProfitThreshold. Calculate profit. Send 80% to trader, 20% to Treasury. |
| `forceClose()` | Owner only | Swap all tokens back to USDC via whitelisted DEX. Transfer all USDC to Treasury. Revoke trader (set to address(0)). |
| `revokeTrader()` | Owner only | Set trader = address(0). |

**execute() implementation:**
```solidity
function execute(address target, bytes calldata data) external {
    require(msg.sender == trader, "not trader");
    require(trader != address(0), "revoked");
    require(allowedTargets[target], "target not whitelisted");

    bytes4 selector = bytes4(data[:4]);
    require(allowedSelectors[selector], "function not allowed");

    // Decode swap params to validate token addresses
    // (implementation depends on DEX router interface)
    _validateTokens(data);

    (bool success, ) = target.call(data);
    require(success, "execution failed");
}
```

**Security Constraints (all enforced in execute()):**

| Constraint | Blocks | How |
|-----------|--------|-----|
| Target whitelist | Calls to arbitrary contracts | `allowedTargets[target]` check |
| Selector whitelist | transfer, approve, any non-swap | `allowedSelectors[selector]` check |
| Token whitelist | Shitcoins, unknown tokens | Decode swap params, verify token ∈ allowedTokens |
| No native transfer | Sending MON to personal wallet | No withdraw(), no receive(), no fallback |
| No ERC-20 extraction | Moving purchased tokens out | transfer/approve selectors excluded |

---

### 3.4 Treasury

Platform fund management.

**Functions:**
| Function | Access | Description |
|----------|--------|-------------|
| `fundAccount(address pa, uint256 amount)` | Owner only | Transfer USDC from Treasury to PA. |
| `receiveFunds(uint256 amount)` | PA contracts | Called during settle() or forceClose(). |
| `withdraw(address to, uint256 amount)` | Owner only | Withdraw platform profits. |

---

## 4. Fund Flow

```
Trader Wallet
     |
     | (1) USDC fee deposit
     v
[PropChallenge] -----(2) fee forwarded-----> [Treasury]
     |                                            |
     | (3) passChallenge()                        |
     v                                            |
[AccountFactory]                                  |
     |                                            |
     | (4) deploy PA                              |
     v                                            |
[TradingAccount (PA)] <---(5) USDC capital--- [Treasury]
     |                                            ^
     | (6) execute() -> DEX swaps                 |
     |    USDC <-> WBTC/WETH                      |
     |                                            |
     |---(7a) settle(): 80% profit -> Trader      |
     |---(7b) settle(): 20% profit ---------------+
     |                                            |
     |---(8) forceClose(): remaining funds -------+
```

---

## 5. Risk Management & Anti-Gambling

| Rule | Parameter | Enforcement |
|------|-----------|-------------|
| Daily loss limit | Max 5% of initial capital/day | Daily P&L snapshot. Freeze execute() for 24h. |
| Max drawdown | Max 10% total drawdown | Triggers forceClose(). |
| Position size cap | Max 30% of capital/trade | execute() validates swap amount. |
| Major pairs only | WBTC, WETH + blue chips | Token whitelist. |
| Min profit to withdraw | Must exceed X% target | settle() checks threshold. |
| Max open positions | 5 concurrent positions (eval) | PropChallenge enforces in openPosition(). |

---

## 6. Fund Security (Anti-Rug)

**Core principle:** Trader never holds keys to the funds.

| Attack Vector | Risk | Mitigation |
|--------------|------|------------|
| Direct USDC transfer | Trader calls USDC.transfer() | transfer() selector not in whitelist |
| Native MON transfer | Send MON to personal wallet | No withdraw/fallback. execute() only allows DEX targets |
| Token transfer after swap | Buy WETH, transfer out | transfer/approve excluded from selectors |
| Malicious DEX | Route through colluding DEX | DEX address whitelist, owner-managed |
| Swap to worthless token | Exchange for valueless token | Token whitelist + no-transfer rule |

---

## 7. Hackathon MVP Scope

### Must Have (Demo Critical)
1. TradingAccount: execute() with 3-layer whitelist, settle(), forceClose()
2. AccountFactory: deployAccount() with whitelist injection, registry
3. PropChallenge: depositFee(), on-chain eval storage, passChallenge()
4. Treasury: fundAccount(), receive profit share
5. Demo: unauthorized transfer attempt → revert

### Nice to Have
- Paper trading frontend with price feed
- Daily loss limit enforcement
- Force liquidation demo
- Portfolio value dashboard

### Out of Scope
- Full paper trading simulation engine
- Multi-DEX routing
- Decentralized evaluation (ZK proof)
- Governance for whitelist management
