# CP5 — Dashboard + Charts

**Owner:** frontend agent B.
**Depends on:** CP0 (contracts) to start with a mock; CP4 (theme.css) for styling; CP3 for live API.
**Files you own:** `optiloop/web/src/App.tsx` (+ small components in `src/`). Uses `theme.css` from CP4.

## Goal
The demo screen. Build against a local mock matching CP0's `/compile` + `/evals` shapes, then flip a
`const API = "http://localhost:8000"` toggle to hit CP3.

## Layout (3 tabs, neumorphic cards)
1. **Loop** — render `fixtures/loop.json` steps as trace rows (id, role, model, tokens, PII badge).
2. **Optimize** — the money shot:
   - Two big `.card`s side by side: **Before $1.84** / **After $0.22**, `.hero-number`, savings % between them.
   - Recharts grouped **bar chart**: per-step cost baseline vs optimized (grayscale, vars from theme).
   - Recharts **donut**: tokens saved from compression.
   - Trace showing each step's model change, e.g. `edit: gpt-4o → llama-3-8b-akash`. Show a "🔒 kept on gpt-4o (Pomerium: PII)" style row for the blocked `read` step — but colorless, use the inset chip + lock glyph.
   - A **Compile** `.btn` that (re)fetches `/compile` with a brief pressed animation.
3. **Evals** — the Buildkite panel:
   - Grid of eval cases as chips: `.chip--pass` / `.chip--fail`.
   - Gate banner: "GATE: GREEN — safe to ship" / "GATE: RED — ship blocked".
   - A toggle to fetch `/evals?fail=e3` so you can demo the gate going red and the ship decision flipping to blocked.

## Copy to bake in
- Header tagline: "A correctness-preserving compiler for agent loops."
- Near the ship decision: "OptiLoop will never ship a cheaper agent that fails your evals."

## Data flow
- On mount: `fetch(API+"/compile")` and `fetch(API+"/evals")`.
- Keep a `USE_MOCK` flag with inline mock objects (copy from CP0) so the UI works even if backend is down — demo-safe.

## Acceptance
- Renders fully from mock with zero backend.
- Flipping `USE_MOCK=false` hits CP3 and shows identical structure with live numbers.
- Bars + donut render in grayscale; pass/fail conveyed by depth + glyph.
- No unit tests. Minimal, readable.
