# REDESIGN_CHECKPOINT.md

> **Purpose**: Mid-task recovery file. If context is lost, read this + DESIGN.md to resume exactly where work stopped.
> Update the "Current step" and "Completed" sections after each component is finished.

---

## Branch
`feat/frontend-redesign`

## Spec source
`DESIGN.md` — read this first, always. This file only tracks *progress*, not the spec itself.

---

## Implementation Order (DESIGN.md §9)

- [x] **Step 1** — CSS custom properties in `index.css` + Tailwind config
- [x] **Step 2** — Font import (Inter + JetBrains Mono via Google Fonts)
- [x] **Step 3** — Header → left sidebar (`components/Header.tsx`, `App.tsx` layout shell)
- [x] **Step 4** — Card/panel style (all components)
- [x] **Step 5** — Button system (all components)
- [x] **Step 6** — Numeric displays (font-mono tabular-nums throughout)
- [ ] **Step 7** — Responsive audit

---

## Current Step
> **Steps 1–6 complete. Begin at Step 7 (responsive audit) if resuming.**

---

## Completed Components
> Append a line here each time a file is fully updated.

| File | Changes applied | Date |
|---|---|---|
| `index.html` | Title, Inter + JetBrains Mono font links | 2026-03-31 |
| `index.css` | Tailwind @theme tokens (bg-base/surface/line/accent/profit/loss/hi/mid) | 2026-03-31 |
| `App.tsx` | Sidebar flex layout shell | 2026-03-31 |
| `components/Header.tsx` | Left sidebar w/ nav items, 2px accent-left bar, wallet at bottom | 2026-03-31 |
| `components/PAStatus.tsx` | Design tokens, mono numerics, flat cards | 2026-03-31 |
| `components/PASwap.tsx` | Design tokens, accent button, accent2 MAX, flat pair selector | 2026-03-31 |
| `components/ChallengeDeposit.tsx` | Design tokens, removed debug block, accent button | 2026-03-31 |
| `components/EvalStatus.tsx` | Design tokens, flat progress bar, status badges, profit/loss buttons | 2026-03-31 |
| `components/TradingPanel.tsx` | Design tokens, profit/loss Long/Short buttons, accent2 token selector | 2026-03-31 |
| `components/PositionList.tsx` | Design tokens, English labels, flat position cards | 2026-03-31 |
| `pages/ChallengePage.tsx` | Design tokens, padding/spacing | 2026-03-31 |
| `pages/PAPage.tsx` | Design tokens, liquidated banner, settle/drawdown sections | 2026-03-31 |

---

## Resume Instructions for LLM

1. Read `DESIGN.md` fully.
2. Check "Current Step" above.
3. Check "Completed Components" — do not re-apply changes to already-done files.
4. Continue from the current step.
5. After finishing each file, append it to the Completed Components table and update Current Step.
