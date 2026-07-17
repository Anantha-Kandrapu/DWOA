# CP5 — Dashboard + Charts

**Owner:** frontend agent B.
**Depends on:** CP0 (contracts) to start with a mock; CP4 (theme.css) for styling; CP3 for live API.
**Files you own:** `optiloop/web/src/App.tsx` (+ small components in `src/`). Uses `theme.css` from CP4.

## Goal
The demo screen. It reflects the **live autonomous controller** — poll `GET /state` every ~1–2s and
render whatever it returns. Build against a local mock matching CP0's `/state` shape first, then flip
`const API = "http://localhost:8000"` to hit CP3.

## Live-loop UI (the Autonomy proof — top of the screen, always visible)
- A **status strip**: "● Controller running" (pulsing dot), current config (baseline|optimized), and a
  live **Nexla feed** ticker of incoming traces (`loop_id`, cost, `via: nexla`).
- An **event history** timeline from `state.history` (observed → compiled → shipped / reverted), so
  judges see it acting on its own with no clicks.
- **Force Compile** button → `POST /force-compile` (your on-stage moment).
- **Inject Fail** toggle → `POST /inject-fail` → watch the gate go red and the controller auto-revert.

## Layout (3 tabs, neumorphic cards) — all fed from `state`
1. **Loop** — render the current loop steps as trace rows (id, role, model, tokens, PII badge).
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
- Poll `fetch(API+"/state")` every ~1–2s (setInterval); render everything from the returned state.
- Buttons `POST` to `/force-compile` and `/inject-fail`, then let the next poll refresh the view.
- Keep a `USE_MOCK` flag with an inline mock `state` object (copy from CP0) that animates on a timer,
  so the UI feels alive even if the backend is down — demo-safe.

## Acceptance
- Renders fully from mock with zero backend.
- Flipping `USE_MOCK=false` hits CP3 and shows identical structure with live numbers.
- Bars + donut render in grayscale; pass/fail conveyed by depth + glyph.
- No unit tests. Minimal, readable.
