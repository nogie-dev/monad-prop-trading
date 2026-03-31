# DESIGN.md — Frontend Design Specification

> **LLM instruction**: When this file exists, read it before any frontend UI task.
> Apply this spec without asking for clarification unless a value is marked `[TBD]`.

---

## 1. Current State (as-is)

| Property | Current value |
|---|---|
| Background | `#0a0b0f` |
| Primary accent | `purple-600 / purple-700` |
| Font | Inter (system-ui fallback) |
| Layout | Sticky top header + single content area (`max-w-6xl`) |
| Card style | `bg-gray-800/50 border border-gray-700 rounded-xl` |
| Button style | `rounded-lg`, solid fill |

---

## 2. Target Tone & Mood

**Keywords**: Restrained tech / Professional trading platform / High information density

- Prioritize **trust and speed** over visual flair
- Numbers and data are the hero — decorative elements are minimal
- Reference aesthetic: Hyperliquid, dYdX v4, Linear.app
- Reference links (visual tone only; palette/component rules here take priority):
  - https://app.lighter.xyz/ — dark, data-first, thin lines
  - https://app.hyperliquid.xyz/trade — high-density tables, crisp line charts
  - https://omni.variational.io/perpetual/ — restrained, pro trading desk feel

---

## 3. Color System

> Fill in values and remove `[TBD]` tags. LLM must use these exact tokens.

```
bg-base        (page background)   : #060709
bg-surface     (card / panel)      : #0c0f13
border-default                     : #171c24
accent         (primary CTA)       : #c6f000
accent-2       (secondary)         : #19c2ff
text-1         (primary text)      : #e8ecf2
text-2         (muted / label)     : #7e8794
positive       (profit / success)  : #3dd598
negative       (loss / error)      : #ff5f5f
```

**Forbidden colors:**
- Any `purple-*` gradient (current accent — replace entirely)
- `blue-*` / `indigo-*` gradient backgrounds
- Stacked semi-transparent overlays (no more than one `/opacity` layer per element)

---

## 4. Typography

```
UI text        : Geist (fallback: Inter, system-ui)
Numeric / mono : JetBrains Mono, tabular-nums
Heading        : same family as UI text, differentiated by weight only
```

**Hierarchy rules:**
- Page title: `text-2xl font-semibold` (avoid `font-bold` — too heavy)
- Section label: `text-xs uppercase tracking-widest` in `text-2` color
- Numeric data: monospace, always `tabular-nums`
- Error / warning copy: `text-sm`, no icons — text only

---

## 5. Layout

```
Current : sticky top header → full-width content area (max-w-6xl, horizontal padding)
Target  : B. Left sidebar (≈200px text sidebar) + right main area
```

Options (replace `[TBD]` with one):
- **A. Keep current** — header + full-width content, improve internals only
- **B. Left sidebar** — 64px icon rail or 200px text sidebar + right main area
- **C. Keep top tabs** — restructure content grid only

---

## 6. Component Specs

> Write change instructions per component. Leave `keep current` if no change needed.

### 6-1. Header — `components/Header.tsx`
```
Current : bg-gray-900/80 backdrop-blur, purple accent on active tab
Target  : Solid bg-surface, border-b border-default, text-1. Active item gets a 2px accent bar on the left + text-1; no blur.
```

### 6-2. Card / Panel
```
Current : bg-gray-800/50 border-gray-700 rounded-xl
Target  : bg-[bg-surface] border border-[border-default] rounded-sm, no shadow.
e.g.    : bg-[bg-surface] border border-[border-default] rounded-none  ← flat
          or rounded-sm for minimal rounding
```

### 6-3. Buttons
```
Primary (main CTA):
  Current : bg-purple-600 hover:bg-purple-500 rounded-lg
  Target  : bg-[accent] text-black hover:brightness-110 rounded-sm

Secondary:
  Current : bg-gray-700 hover:bg-gray-600 rounded-lg
  Target  : border border-[border-default] text-[text-1] bg-transparent hover:border-[accent-2] rounded-sm

Danger (liquidate / destructive):
  Current : bg-red-700 hover:bg-red-600 rounded-lg
  Target  : bg-[negative] text-black hover:brightness-110 rounded-sm
```

### 6-4. Numeric display (balances, P&L, prices)
```
Current : plain text, text-white / text-green-400 / text-red-400
Target  : font-mono tabular-nums; default text-1. Use positive/negative colors only for value text; labels in text-2.
e.g.    : font-mono tabular-nums, retain color for positive/negative only
```

### 6-5. Status badges (Testnet, Liquidated, etc.)
```
Current : rounded bg-purple-900/50 text-purple-300 border-purple-700/50
Target  : Flat, rounded-sm. Border in accent/accent-2/negative; background a light tint of the same; text in text-1 or matching accent.
```

### 6-6. Input fields
```
Current : bg-gray-700 border-gray-600 rounded-lg
Target  : bg-[#0f1319] border border-[border-default] rounded-sm text-1 placeholder:text-2 focus:ring-1 ring-[accent] outline-none
```

### 6-7. Price Chart
```
Library  : lightweight-charts
Container: bg-[bg-surface] border border-[border-default] rounded-sm, no shadow
Colors   : main line/candle accent; secondary line accent-2; bullish positive; bearish negative
Axes/Grid: labels in text-2; grid lines extremely light in text-2
Crosshair: thin lines, highlight accent-2
Tooltip  : floating box bg-[bg-surface] + border-[border-default]; monospace numbers only (price/time); text-1
```

---

## 7. Interaction Rules

```
Hover transition   : transition-colors duration-150
Focus ring         : outline-none ring-1 ring-[accent]
Loading state      : opacity-60 cursor-not-allowed, no spinner
Error display      : border-[negative] text-[negative]; avoid extra error boxes
```

---

## 8. Hard Constraints (never apply)

- No `purple-*` / `indigo-*` / `blue-*` gradient backgrounds
- No heavy shadows (`shadow-xl`, `shadow-2xl`)
- No icon overuse (no Heroicons / Lucide unless explicitly specified)
- No pill buttons (`rounded-full`)
- No bounce / spin animations, no loading spinners
- No stacked background gradient overlays

---

## 9. Implementation Priority

> Work through this list in order when executing a "redesign" task.

1. [ ] Define CSS custom properties in `index.css`, wire to Tailwind config
2. [ ] Replace fonts (Google Fonts or local import)
3. [ ] Redesign Header
4. [ ] Unify card / panel style
5. [ ] Unify button system
6. [ ] Apply monospace + `tabular-nums` to all numeric displays
7. [ ] Responsive audit

---

## 10. Changelog

| Date | Change |
|---|---|
| 2026-03-31 | Initial draft — fill `[TBD]` values before starting work |
| 2026-04-01 | Filled all TBDs, added chart spec and reference link guidance |
