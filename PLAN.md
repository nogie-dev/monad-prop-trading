# PLAN.md — Build Progress

> Update this file at the end of every session.
> New sessions: read this first to understand current state.

## Phase 1: Smart Contracts [IN PROGRESS]
- [x] foundry.toml + remappings.txt setup
- [x] OpenZeppelin dependency install (v5.6.1)
- [x] forge-std install (v1.15.0)
- [x] TradingAccount.sol — execute() with 3-layer whitelist
- [x] TradingAccount.sol — settle(), forceClose(), revokeTrader()
- [x] TradingAccount.sol — getPortfolioValue()
- [x] AccountFactory.sol — deployAccount() + registry
- [x] AccountFactory.sol — whitelist config injection
- [x] PropChallenge.sol — depositFee() with USDC
- [x] PropChallenge.sol — EvaluationAccount storage + openPosition/closePosition
- [x] PropChallenge.sol — passChallenge() → trigger Factory
- [x] Treasury.sol — fundAccount(), receiveFunds(), withdraw()
- [x] Unit tests: TradingAccount (happy path + attack vectors)
- [x] Unit tests: PropChallenge (fee deposit + eval flow)
- [x] Unit tests: AccountFactory (deploy + registry)
- [x] Unit tests: Treasury (fund flow)
- [x] Integration test: full flow (deposit → pass → PA deploy → trade → settle)
- [x] Deploy script (script/Deploy.s.sol)
- [ ] Testnet deployment
- [ ] Record deployed addresses in frontend/src/config/addresses.ts

## Phase 2: Paper Trading Frontend [COMPLETE]
- [x] React project setup (Vite + TypeScript + Tailwind)
- [x] Wallet connection (ethers.js v6)
- [x] Price feed integration (CoinGecko API)
- [x] Challenge fee deposit UI → PropChallenge.depositFee()
- [x] Virtual trading UI (open/close position buttons)
- [x] On-chain position recording → PropChallenge.openPosition/closePosition()
- [x] P&L display + pass/fail evaluation status
- [ ] Pass trigger (team EOA calls passChallenge)

## Phase 3: PA Dashboard Frontend [COMPLETE]
- [x] PA status display (balance, positions, P&L) — PAStatus.tsx
- [x] Execute trade UI → TradingAccount.execute() — PASwap.tsx (USDC/WETH/WBTC pairs via TestRouter)
- [x] Settlement UI → settle() — PAPage.tsx settle button
- [x] Force close display — drawdown warning (>10% below initial capital)
- [x] "Unauthorized transfer" demo button (shows revert) — AttackDemo section in PAPage
- [x] Tab navigation (Challenge / PA Dashboard) — Header.tsx updated
- [x] App.tsx page routing (challenge | pa state)
- [x] TestRouter ABI — src/abi/TestRouter.ts
- [x] dexRouter added to ADDRESSES config

## Phase 4: Demo & Polish [NOT STARTED]
- [ ] End-to-end demo scenario rehearsal
- [ ] Pitch deck / presentation slides
- [ ] README.md with project description + screenshots

---

## Session Log
<!-- Append a line after each session -->
<!-- Format: YYYY-MM-DD HH:MM | What was done | What's next -->
2026-03-26 23:00 | Phase 1 contracts complete: 4 contracts (TradingAccount, AccountFactory, PropChallenge, Treasury) + 24 tests all passing + Deploy.s.sol | Next: testnet deployment, then Phase 2 frontend
2026-03-27 | Phase 2 frontend complete: Vite+React+Tailwind setup, wallet connection (MetaMask/Monad), CoinGecko price feed, challenge deposit UI, trading panel (open/close positions), P&L display with progress bar, contract ABIs extracted | Next: Phase 3 PA Dashboard
2026-03-30 | Phase 3 PA Dashboard complete: TestRouter ABI, dexRouter address config, PAStatus (balances + P&L), PASwap (4 token pairs via TradingAccount.execute), PAPage (settle + drawdown warning + attack demo), Header tab nav, App.tsx routing, pre-existing TS errors fixed | Next: Phase 4 demo polish
