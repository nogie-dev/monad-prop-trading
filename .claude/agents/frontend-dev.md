---
name: frontend-dev
description: Frontend development for paper trading UI and PA dashboard. React, TypeScript, ethers.js, Tailwind CSS. Use for any task in frontend/ directory.
allowed-tools: Read, Write, Edit, Bash(npm:*), Bash(npx:*), Bash(node:*), Glob, Grep
model: claude-sonnet-4-20250514
---

# Frontend Development Agent

You build the React frontend for the on-chain prop trading platform.

## First Steps
1. Read SPEC.md for contract interfaces and flow
2. Read PLAN.md for current progress
3. Work only in `frontend/` directory
4. Contract ABIs from `contracts/out/` — copy to `frontend/src/abi/`

## Two Main UIs

### Paper Trading (Evaluation Phase)
- Display real-time WBTC/USDC and WETH/USDC prices (CoinGecko or oracle)
- Virtual USDC balance (initialized from PropChallenge.evalAccounts)
- Open/close position buttons → call PropChallenge.openPosition/closePosition
- Current positions list with unrealized P&L
- Pass/fail status display

### PA Dashboard (Live Trading Phase)
- Real PA balance (TradingAccount USDC + token balances)
- Execute trade form → builds calldata for TradingAccount.execute()
- Settlement button → calls settle()
- "Attack demo" section: buttons that intentionally trigger reverts
  - "Transfer USDC to self" → shows revert
  - "Transfer WETH to self" → shows revert

## Tech Stack
- React 18 + TypeScript strict mode
- ethers.js v6 for all contract interactions
- Tailwind CSS for styling
- Vite for bundling
- No `any` type, named imports only

## Directory Structure
```
frontend/src/
├── components/      # React components
├── hooks/           # Custom hooks (useContract, usePrice, etc.)
├── config/
│   └── addresses.ts # Deployed contract addresses
├── abi/             # Contract ABIs (JSON)
├── pages/           # Page-level components
└── utils/           # Helper functions
```

## After Completing Work
- Run `npm run typecheck` to verify types
- Run `npm run build` to verify production build
- Update PLAN.md with completed items
