# Monad On-Chain Prop Trading Platform

## Project Overview
On-chain prop trading platform on Monad. Traders pay USDC challenge fee, pass paper trading evaluation (recorded on-chain), then trade with platform-funded Performance Account (PA) via restricted Custom Smart Account.

Full architecture: see **SPEC.md**
Current progress: see **PLAN.md**

## Tech Stack
- **Contracts**: Solidity 0.8.24+, Foundry (forge, cast, anvil)
- **Frontend**: React 18, TypeScript, ethers.js v6, Tailwind CSS
- **Chain**: Monad (EVM-compatible, high throughput, low gas)
- **Token standard**: All funds in USDC (ERC-20 stablecoin)

## Key Architecture (read SPEC.md for full detail)
- 4 contracts: PropChallenge, TradingAccount, AccountFactory, Treasury
- PA = Custom Smart Account (NOT ERC-4337). Trader gets execute() permission only, never keys.
- execute() enforces 3-layer whitelist: target address, function selector, token address
- Paper trading evaluation: on-chain position recording with off-chain oracle price feed

## Contract Rules (CRITICAL — never violate)
- TradingAccount MUST validate target, selector, AND token in execute()
- NEVER add transfer (0xa9059cbb), approve (0x095ea7b3), transferFrom (0x23b872dd) to selector whitelist
- PA has NO withdraw(), NO receive(), NO fallback
- Owner = platform multisig, Trader = execute() caller only
- All position/balance changes go through whitelisted DEX router only

## Foundry Commands
```bash
# Build
cd contracts && forge build

# Test (verbose)
cd contracts && forge test -vvv

# Test single contract
cd contracts && forge test --match-contract TradingAccountTest -vvv

# Gas report
cd contracts && forge test --gas-report

# Deploy to Monad testnet
cd contracts && forge script script/Deploy.s.sol:DeployScript --rpc-url $MONAD_RPC --broadcast --verify

# Local testing with anvil
anvil --fork-url $MONAD_RPC

# Interact via cast
cast call <address> "getStatus(address)" <trader> --rpc-url $MONAD_RPC
```

## Frontend Commands
```bash
cd frontend && npm install
cd frontend && npm run dev      # dev server
cd frontend && npm run build    # production build
cd frontend && npm run typecheck
```

## Code Style
- Solidity: custom errors (no require strings), NatSpec on all public/external functions
- Solidity: use OpenZeppelin (Ownable, ReentrancyGuard) where applicable
- Solidity: explicit visibility on all functions and state variables
- TypeScript: strict mode, no `any`, named imports only
- Git: conventional commits (feat:, fix:, test:, docs:)

## Directory Structure
```
contracts/
├── src/                    # Solidity source
│   ├── PropChallenge.sol
│   ├── TradingAccount.sol
│   ├── AccountFactory.sol
│   └── Treasury.sol
├── test/                   # Foundry tests
├── script/                 # Deployment scripts
├── foundry.toml
└── remappings.txt
frontend/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── config/addresses.ts # Deployed contract addresses
│   └── abi/                # Auto-generated from contracts/out/
└── package.json
```

## Sub-Agent Routing Rules
**Parallel dispatch** (ALL conditions met):
- 3+ unrelated tasks or independent domains
- No shared files between agents
- Clear file boundaries (contracts/ vs frontend/ vs test/)

**Sequential dispatch** (ANY condition triggers):
- Tasks have dependencies (B needs output from A)
- Shared files or state (merge conflict risk)
- Unclear scope needing exploration first

**Background dispatch**:
- Research, codebase exploration, analysis (read-only)
- Results not blocking current work

## PLAN.md Update Rule
After completing any task, always update the corresponding item in PLAN.md from `- [ ]` to `- [x]`. Also append to the Session Log at the end of each session.

## When Compacting
Always preserve: modified file list, current PLAN.md status, contract interface signatures, failing test details, deployed addresses.
