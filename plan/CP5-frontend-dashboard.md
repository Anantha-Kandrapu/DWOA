# CP5 — Dashboard

**Depends on:** CP0 contracts, CP4 styles, and CP3 for the live API
**Files:** `optiloop/web/src/App.tsx`

## Goal

Make the prompt and tool optimization visible and auditable. Poll `GET /state` every one to two
seconds and render the returned state.

## Required UI

Use two top-level tabs: **Live** and **Replay**.

### Controller

- Running state, current configuration, and latest event.
- Trace history: observed → compiled → shipped or reverted.
- **Force Compile** button.
- **Inject Fail** toggle for the rollback demo.

### Live iteration graph

- Plot `quality_score` against iteration sequence as a live-updating line graph.
- Append a dot when polling discovers a new iteration; preserve historical points.
- Let the line move up or down—never clamp or smooth away regressions.
- Hover or focus a dot to show timestamp, score, gate, decision, prompt tokens, tool calls, latency,
  cost, and its change summaries.
- Clicking a dot opens its prompt diff, tool audit, and eval results below the graph.
- Use an SVG polyline and circles; no chart dependency is required.

### Replay tab

- List old iterations newest first with sequence, timestamp, score, gate, and decision.
- Selecting an iteration loads its immutable snapshot.
- Replay animates recorded phases: observed → compiled → evaluated → shipped or kept baseline.
- Replay must never call `/force-compile`, rerun a tool, or repeat a side effect.
- Provide play/pause, previous, next, and restart controls.

### Before and after

Show four derived metrics:

- prompt tokens;
- tool-call count;
- estimated latency;
- estimated cost.

Use native CSS bars or counters. Do not hardcode `$1.84`, `$0.22`, or a savings percentage.

### Prompt audit

- Show the original and optimized prompt for each changed step.
- Identify deduplicated context, removed history, and tokens saved.
- Show preserved safety, policy, task, and output-format constraints.

### Tool audit

- List original and optimized tool plans.
- Identify merged or removed read-only calls.
- Show the retained call that supplies each reused result.
- Mark side-effecting calls as protected and unchanged.

### Eval gate

- Show each behavioral case as pass or fail.
- Show whether side effects match.
- Display **safe to ship** only when every case passes and side effects match.

### Supporting decisions

Model routing and policy blocks may appear below the optimization audit. They are not the hero view.

## Data flow

- Poll `fetch(API + "/state")`.
- POST `/force-compile` and `/inject-fail`.
- Keep one fixture-backed fallback matching `schemas.md`.
- Label fallback data as simulated.

## Acceptance

- The dashboard runs against both the fallback and live API shapes.
- Prompt and tool changes are inspectable, not only summarized.
- New iterations append to the graph and every dot exposes its exact changes.
- Replay reproduces an old snapshot without mutating live state.
- Every displayed metric comes from API data.
- Pass/fail is conveyed by text or glyph as well as visual styling.
- No chart dependency or unit-test framework is required.
