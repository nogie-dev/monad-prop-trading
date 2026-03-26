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

## Phase 2: Paper Trading Frontend [NOT STARTED]
- [ ] React project setup (Vite + TypeScript + Tailwind)
- [ ] Wallet connection (ethers.js v6)
- [ ] Price feed integration (CoinGecko API or DEX oracle)
- [ ] Challenge fee deposit UI → PropChallenge.depositFee()
- [ ] Virtual trading UI (open/close position buttons)
- [ ] On-chain position recording → PropChallenge.openPosition/closePosition()
- [ ] P&L display + pass/fail evaluation status
- [ ] Pass trigger (team EOA calls passChallenge)

## Phase 3: PA Dashboard Frontend [NOT STARTED]
- [ ] PA status display (balance, positions, P&L)
- [ ] Execute trade UI → TradingAccount.execute()
- [ ] Settlement UI → settle()
- [ ] Force close display
- [ ] "Unauthorized transfer" demo button (shows revert)

## Phase 4: Demo & Polish [NOT STARTED]
- [ ] End-to-end demo scenario rehearsal
- [ ] Pitch deck / presentation slides
- [ ] README.md with project description + screenshots

---

## Session Log
<!-- Append a line after each session -->
<!-- Format: YYYY-MM-DD HH:MM | What was done | What's next -->
2026-03-26 23:00 | Phase 1 contracts complete: 4 contracts (TradingAccount, AccountFactory, PropChallenge, Treasury) + 24 tests all passing + Deploy.s.sol | Next: testnet deployment, then Phase 2 frontend
