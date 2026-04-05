# Monad Prop Trading

An on-chain prop trading platform. Traders pay a USDC challenge fee and, upon passing a paper trading evaluation, are granted a platform-funded Performance Account (PA) to execute real DEX trades.

This project replicates the structure of traditional prop firms (e.g., FTMO) using smart contracts, achieving a **trustless capital delegation model** where traders hold trading permissions without ever holding the keys to the funds.

---

## Architecture Overview

![Architecture](./propnad.drawio.svg)

### Phase 1 — Evaluation

1. A trader pays the USDC challenge fee, creating an evaluation slot on-chain.
2. The trader executes simulated trades via the web frontend using oracle prices; each position open/close is recorded on-chain.
3. The platform owner monitors P&L and:
   - Profit target met → calls `passChallenge()` → PA is automatically deployed
   - Drawdown limit exceeded → calls `failChallenge()` → evaluation ends with no refund

### Phase 2 — Live Trading

1. `AccountFactory` deploys a trader-specific `TradingAccount` (PA).
2. `Treasury` funds the PA with USDC operating capital.
3. The trader can only call `execute()` on the PA, which enforces a **3-layer whitelist** to permit only approved trades.
4. On profit target → `settle()` → 80% to trader / 20% to Treasury.
5. On drawdown limit exceeded → `forceClose()` → full funds returned to Treasury, trader permissions revoked.

---

## Contract Structure

```
contracts/src/
├── PropChallenge.sol     # Fee collection, paper trading record, pass/fail judgment
├── AccountFactory.sol    # TradingAccount deployment and registry
├── TradingAccount.sol    # Performance Account (PA) — execute() with 3-layer validation
└── Treasury.sol          # Platform fund custody, PA funding, profit withdrawal
```

### Contract Relationships

- `PropChallenge` → `passChallenge()` → `AccountFactory.deployAccount()` → `TradingAccount`
- `PropChallenge` fee → `Treasury` → `fundAccount()` → `TradingAccount`
- `TradingAccount` → `settle()` / `forceClose()` → `Treasury`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin |
| Frontend | React 18, TypeScript, ethers.js v6, Tailwind CSS, Vite |
| Chain | Monad Testnet (EVM-compatible, high throughput, low latency) |
| Base Currency | USDC (ERC-20) |
| Price Feed | CoinGecko API (evaluation phase) |

---

## Directory Structure

```
monad-prop-trading/
├── contracts/
│   ├── src/                  # Contract source files
│   ├── test/                 # Foundry tests
│   └── script/Deploy.s.sol   # Deployment script
└── frontend/
    └── src/
        ├── components/       # UI components
        ├── hooks/            # useWallet, useContracts, usePrices
        ├── config/           # Contract addresses, constants
        ├── abi/              # Contract ABIs
        └── pages/            # ChallengePage
```

---

## Getting Started

```bash
# Build and test contracts
cd contracts
forge build
forge test -vvv

# Run frontend
cd frontend
cp .env.example .env   # Fill in contract addresses
npm install
npm run dev
```

---

## Security Design (TradingAccount execute() 3-Layer Validation)

The `execute()` function enforces three independent whitelist checks to prevent unauthorized fund movement:

- **Target address whitelist** — only approved DEX router contracts may be called
- **Function selector whitelist** — only approved swap/trade selectors are permitted; transfer-related selectors (`transfer`, `approve`, `transferFrom`) are explicitly excluded
- **Token address whitelist** — only approved token addresses may interact with the PA

This ensures traders can execute DEX trades but can never directly transfer, approve, or withdraw funds from the PA.

---

## Debug Mode (Force-adjust virtual balance and state)

Debug functions and scripts are provided to quickly verify pass/fail flows during development and testing.

- `PropChallenge` debug functions (owner only):
  - `activateChallengeDebug(address trader)`: Instantly sets the trader to `ACTIVE` state without paying a fee.
  - `increaseVirtualBalance(address trader, uint256 amount)`: Increases virtual balance.
  - `decreaseVirtualBalance(address trader, uint256 amount)`: Decreases virtual balance.

- Script: `contracts/script/TestDebugTrigger.s.sol`
  - Toggle flags to run `activate / increase / decrease / pass / setPaFundingAmount / treasury mint` individually.
  - Example usage (requires env vars: `PRIVATE_KEY`, `PROP_CHALLENGE_ADDRESS`, `DEBUG_TRADER`, `DEBUG_AMOUNT`, etc.):
    ```sh
    cd contracts
    set -a && source ../.env && set +a
    export DEBUG_TRADER=<trader_address>
    export DEBUG_AMOUNT=<6-decimals USDC value>
    forge script script/TestDebugTrigger.s.sol:TestDebugTrigger \
      --rpc-url "$MONAD_RPC" \
      --private-key "$PRIVATE_KEY" \
      --chain-id 10143 \
      --broadcast
    ```

Debug flow example:
1. Call `activateChallengeDebug` to enter `ACTIVE` state.
2. Call `increaseVirtualBalance` to exceed the profit target (e.g., 11,000 USDC).
3. Call `passChallenge` → verify pass / PA deployment and funding behavior.
4. Call `decreaseVirtualBalance` to reproduce failure condition scenarios.
