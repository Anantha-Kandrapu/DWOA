# CP4 — Neumorphic Monochrome Design System

**Owner:** frontend agent A.
**Depends on:** CP0 (so you know what will render).
**Files you own:** `optiloop/web/src/theme.css`, and scaffold `optiloop/web` (Vite). Do NOT write app logic — CP5 owns `App.tsx` content.

## Goal
A single CSS file that gives the whole app a clean neumorphic, colorless look. CP5 just applies
these classes.

## Scaffold
```
npm create vite@latest web -- --template react-ts
cd web && npm i recharts
```
Leave `App.tsx` as a placeholder (`<div className="board">OptiLoop</div>`); CP5 fills it.

## theme.css — rules
- Palette: base `#e0e0e0`; text `#3a3a3a`; near-black accent `#1a1a1a` (ONLY for hero number + pass state). No other colors.
- Shadow pair (the neumorphic core):
  - outset: `box-shadow: 8px 8px 16px #bebebe, -8px -8px 16px #ffffff;`
  - inset (pressed): `box-shadow: inset 6px 6px 12px #bebebe, inset -6px -6px 12px #ffffff;`
- Classes to provide:
  - `.card` (outset, rounded 20px, padding), `.card--pressed` (inset).
  - `.hero-number` (large, `#1a1a1a`, tabular-nums).
  - `.chip` (outset small pill), `.chip--pass` (outset + check ::before "✓"), `.chip--fail` (inset + cross ::before "✕"). Convey pass/fail by depth + glyph, NOT color.
  - `.btn` (outset, active state = inset). `.btn:active` presses in.
  - `.bar-grid`, `.trace-row`, `.tab`/`.tab--active`.
- Recharts styling helper vars: bars use grayscale — baseline bars `#9a9a9a`, optimized bars `#4a4a4a`; grid lines `#cfcfcf`. Export these as CSS vars so CP5 reads them.
- Rounded, soft, generous whitespace. Font: system sans, `tabular-nums` for money.

## Acceptance
- `npm run dev` serves a blank neumorphic board.
- All classes above exist and visibly render inset vs outset.
- Zero color beyond the gray ramp + near-black accent.
- No unit tests.
