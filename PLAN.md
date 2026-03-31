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

## Phase 4: Monitoring & Liquidation [COMPLETE]
- [x] Discover PAs dynamically (AccountFactory.getAllAccounts) instead of static MONITOR_TRADERS
- [x] Monitor portfolios with monitoring.py price feed (Chainlink) to value USDC/WETH/WBTC and compute drawdown/thresholds
- [x] Frontend: show liquidation reference price (Chainlink) alongside pool-priced P&L (DEX getAmountOut)
- [x] Liquidation entrypoint (onlyAdmin): liquidate(dexTarget) swaps WETH/WBTC → USDC via router, leaves 1 wei dust, emits Liquidated event
- [x] PA pre-approves router in constructor; liquidate() uses best-effort swap (0 minAmountOut), emits LiquidationSwapFailed on failure

---

## Session Log
<!-- Append a line after each session -->
<!-- Format: YYYY-MM-DD HH:MM | What was done | What's next -->
2026-03-26 23:00 | Phase 1 contracts complete: 4 contracts (TradingAccount, AccountFactory, PropChallenge, Treasury) + 24 tests all passing + Deploy.s.sol | Next: testnet deployment, then Phase 2 frontend
2026-03-27 | Phase 2 frontend complete: Vite+React+Tailwind setup, wallet connection (MetaMask/Monad), CoinGecko price feed, challenge deposit UI, trading panel (open/close positions), P&L display with progress bar, contract ABIs extracted | Next: Phase 3 PA Dashboard
2026-03-30 | Phase 3 PA Dashboard complete: TestRouter ABI, dexRouter address config, PAStatus (balances + P&L), PASwap (4 token pairs via TradingAccount.execute), PAPage (settle + drawdown warning + attack demo), Header tab nav, App.tsx routing, pre-existing TS errors fixed | Next: Phase 4 demo polish
2026-03-31 | Phase 4 Monitoring & Liquidation complete: TradingAccount.liquidate(dexTarget) with 1wei dust + LiquidationSwapFailed event, TradingAccount role split (owner=platform, challenger=PropChallenge for setInitialCapital), monitoring.py getAllAccounts() dynamic discovery + PA drawdown auto-liquidate, PAStatus pool price display (DEX getAmountOut), PAPage Force Liquidate button (admin only), 24/24 tests passing | Next: additional features (faucet, leaderboard)
2026-03-31 | Fix liquidation root cause: redeployed all contracts so AccountFactory.owner()=EOA (0x2637C325), new PAs now receive ADMIN_ROLE to deployer EOA instead of PropChallenge. monitoring.py liquidate() flow now works directly. PropChallenge: 0x41Fe5dd2b0b606383028bC0c951842E94db53953, AccountFactory: 0x2dc014Fe3235Daf0A99851C52B0fD10AFa8c1B60, Treasury: 0xE7Ae0975289729706Ca44C279f0EE75643c4e038 | Next: full demo run
