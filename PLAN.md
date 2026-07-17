# DWOA — Build Plan

**A correctness-preserving compiler for agent loops.** Ingests an agent loop, optimizes its prompts
and tool usage, and refuses to ship any version that fails your evals. Model routing is supporting
infrastructure, not the product.

> "DWOA removes wasted prompt tokens and tool calls, then proves the optimized agent still works."

## Locked decisions

- **Frontend:** single-file Vite React (`react-ts`), plain `fetch` + `useState`. No TanStack, no router, no query lib.
- **Charts:** native CSS bars and counters; no chart dependency is required.
- **Design:** neumorphic, monochrome. Base `#e0e0e0`, dual light/dark soft shadows. Only "accent" = near-black for the hero cost number + passing state. Pass = outset chip + check glyph; fail = inset/pressed chip + cross glyph.
- **Backend:** FastAPI, ~200 lines. Endpoints: `POST /compile`, `GET /evals`, `POST /run`.
- **Loop execution:** deterministic local fixtures first. External integrations must be labeled as
  fixture-backed until verified live.
- **Eval engine:** local deterministic gate only. No live evaluator required.
- **Verification:** one small deterministic end-to-end check for prompt preservation, tool safety,
  and eval-gated rollback.

## Prize tracks we're targeting (cash lives in tracks, general 1st = badge only)

- **Zero.xyz — $2,500 (biggest).** Go deep: DWOA analyzes, removes, merges, and selects tool
  calls, then executes the retained calls through Zero's no-key layer.
- **Pomerium — $1,000 (Most Innovative).** Policy enforcement constrains optimization, but is not
  the core product.
- **Optional integrations:** Pomerium, Nexla, and Akash are supporting only; include them when they
  strengthen the verified optimization story.

## Judging criteria (each 20%) — build to these

- **Idea** — the optimizer for prompts and tool use inside agent loops.
- **Technical Implementation** — clean, working, debuggable.
- **Tool Use** — tool-plan optimization must be real and visible; Zero may execute retained calls.
- **Presentation** — 3-min demo; prompt diff + tool audit + verified before/after metrics.
- **Autonomy — "acts on real-time data without manual intervention."** THIS is our weak axis. The
  self-running loop (below) is what earns it. Do not skimp here.

## Autonomy loop (self-directing — the theme + the Autonomy 20%)

DWOA runs itself: **observe → detect → compile → eval → ship/revert**, no human in the loop.

1. **Observe** — consume an agent trace containing prompts, tool calls, latency, and cost.
2. **Detect** — find duplicated context, redundant read-only calls, or an expensive loop.
3. **Compile (act)** — compresses prompts, removes or merges redundant tool calls, selects the
   cheapest correct tools, then applies model routing as a secondary pass.
4. **Eval (observe)** — runs the local deterministic eval gate.
5. **Self-correct** — if evals pass → ship the optimized config; if red → keep the safe one.

Hybrid demo: the loop is running autonomously on its own; a **Force Compile** button lets you trigger
a dramatic compile on stage. So it scores Autonomy *and* gives you a controllable money-shot.

Each controller tick creates an immutable iteration snapshot. The dashboard plots quality score over
time, explains every dot, and can replay any previous snapshot without rerunning it.

Full visibility is required before the final dot appears. Each sandbox job exposes an ordered event
stream: queued → running → prompt optimized → tools optimized → eval started → eval completed →
completed/failed. The local leader polls these events, forwards sanitized copies to Nexla, and makes
them visible in the Live tab. No phase may happen only inside an opaque worker log.

When a workflow optimization session ends, the local leader stores a durable history record with
the baseline, every candidate iteration, every lifecycle event, prompt/tool audits, eval results,
winner, rollback/ship decision, and final workflow configuration. The History tab can reopen any
completed session after a leader restart.

## Scope

- **Core (must demo):** prompt optimization + tool optimization + eval gate + a live iteration
  timeline showing quality score, tokens, tool calls, latency, and cost.
- **Prompt optimization:** remove duplicated or irrelevant context, but add concise known facts when
  they avoid clarification turns. Optimize total workflow tokens, turns, latency, and cost—not raw
  prompt length—while preserving required constraints.
- **Tool optimization:** remove unused calls, merge duplicate reads/searches, reuse safe results, and
  choose a cheaper equivalent tool where one exists.
- **Supporting only:** model routing and governance policy.
- **Stretch only:** cross-run caching after correctness and invalidation rules are proven.

## Parallel execution and integrations

### Leader and sandbox boundary

- The leader/controller runs locally and never executes optimization candidates or evals.
- Generate four variants per batch: conservative, prompt-first, tool-first, and balanced.
- Dispatch every variant concurrently to authenticated sandbox workers.
- Use local Docker workers during development and Akash workers for deployed runs.
- Evaluate each candidate independently and append it to the live score graph as soon as the batch completes.
- Keep tool side effects simulated during optimization; Replay never executes them.
- Refuse the batch when no sandbox is available; never fall back to leader-side execution.

### Nexla: live monitoring

- Use Nexla as the real monitoring and trace layer, not a cosmetic label.
- Authenticate with a session token obtained from the service key.
- Read monitoring/resource status through `NEXLA_API_URL`.
- Publish sanitized iteration telemetry through a dedicated Nexla webhook URL; never send prompt text,
  tool arguments, API keys, or repository contents.
- Display Nexla connection state and trace source in the dashboard.

### AkashML: explicit inference

- Use the OpenAI-compatible AkashML API for real candidate inference and measured token usage.
- Discover available models from `/v1/models` or set `AKASHML_MODEL` explicitly.
- Do not call AkashML on autonomous background ticks until per-run budget and rate limits exist.
- Trigger paid inference only through an explicit user action or a bounded experiment batch.

### Akash: sandbox backend

- Package the worker as a pinned Docker image and deploy it through the Akash Console API.
- Keep the leader local; only worker containers run optimization and eval code.
- Scale workers with the Akash SDL service count or multiple worker URLs.
- Creating a deployment requires an explicit confirmation because it spends credits.
- Launch flow: create deployment → poll bids → accept a lease → run the batch → close the deployment.

### Environment

```dotenv
NEXLA=
NEXLA_API_URL=https://dev-api-express-code.nexla.com/
NEXLA_MONITORING_URL=https://veda-ai.nexla.io/monitoring/
NEXLA_WEBHOOK_URL=
AKASH=
AKASHML=
AKASHML_MODEL=
```

Real values live only in `optiloop/server/.env`; `.env.example` contains placeholders and `.gitignore`
must continue excluding every real `.env` file.

## Positioning (the wedge)

Model routing is already widely available. DWOA optimizes the parts routers do not:

> "DWOA compiles an entire agent loop — prompts, context, and tools — then proves it didn't regress."

The moat = **eval-backed prompt rewriting** + **tool-plan optimization** + **runtime-agnostic input**.
Routing, provider choice, and policy enforcement support that compiler.

## Sponsor hooks — go deep on 4, don't bolt on 6

- **Zero.xyz = optimized tool execution layer.** DWOA compares the original and optimized tool
  plans; retained calls execute through Zero. The demo must show fewer calls, not merely a Zero label.
- **Akash = optional cheap model target.** Useful after prompt and tool optimization, but not the
  product claim.
- **Local eval gate = correctness proof.** Fixture-backed evals decide ship/revert with no cloud credits.
- **Pomerium = compilation constraint.** Policy blocks PII-touching steps from cascading to an
  external/open model unless authorized. Implement policy logic locally (`policy.json`); layer real
  Pomerium only if time allows.
- **Cursor = input format (bonus).** A Cursor-style coding-agent trace is one supported use case.
- **Nexla = optional trace source.** Use only if a real feed is verified; otherwise label fixtures.
- **Fillmore = skip.** It does not fit the product.

## Repo layout

```
optiloop/
  server/
    main.py          # endpoints incl. /state, /force-compile (CP3)
    controller.py    # autonomous observe→compile→eval→ship/revert loop (CP6)
    trace_feed.py    # fixture-backed or verified live trace input (CP6)
    optimizer.py     # prompt + tool-plan optimization (CP1)
    router.py        # supporting model choice + policy constraints (CP1)
    evals.py         # eval gate, pass/fail, ship-block (CP2)
    requirements.txt
  web/
    src/App.tsx      # dashboard: live loop status, cost cards, bars, eval table, trace (CP5)
    src/theme.css    # neumorphic monochrome system (CP4)
  fixtures/
    loop.json        # sample agent loop (Cursor SDK-style)     (CP0)
    traces.json      # deterministic agent trace stream           (CP0)
    evals.json       # ~6 eval cases                              (CP0)
    pricing.json     # local model pricing table                  (CP0)
    policy.json      # Pomerium policy                            (CP0)
  schemas.md         # shared JSON + API contracts                (CP0)
```

## Checkpoints & parallelism

Each checkpoint is a self-contained file in `plan/`. A subagent claims one, reads it, builds only
what it owns against the contracts in `CP0`. **CP0 must land first** — it defines every JSON shape
and API response so the rest can build in parallel without touching each other's files.

```
                 ┌──────────────────────────┐
                 │ CP0  scaffold + contracts │  (do first, blocks all)
                 └────────────┬─────────────┘
        ┌─────────────┬───────┴───────┬──────────────┐
        ▼             ▼               ▼              ▼
   ┌─────────┐  ┌──────────┐   ┌────────────┐  ┌────────────┐
   │ CP1     │  │ CP2      │   │ CP4        │  │ (sponsor   │
   │ prompts │  │ evals    │   │ design sys │  │ hooks fold │
   │ + tools │  │ + gate   │   │ theme.css  │  │ into CP1)  │
   └────┬────┘  └────┬─────┘   └─────┬──────┘  └────────────┘
        └──────┬─────┘               │
               ▼                     │
          ┌─────────┐                │
          │ CP3 API │                │
          └────┬────┘                │
               └──────────┬──────────┘
                          ▼
                    ┌────────────┐
                    │ CP5 dash   │  (builds against CP0 contracts;
                    │ + charts   │   swaps mock→real API when CP3 lands)
                    └────────────┘
```

- **Parallel wave 1:** CP1, CP2, CP4 (all only need CP0).
- **CP6** (autonomous controller + trace feed) needs CP1 + CP2.
- **CP3** needs CP1 + CP2 + CP6 (exposes `/state`, `/force-compile`).
- **CP5** can start against CP0 contracts immediately (mock fetch), wire to CP3 when ready.
- **CP7** (integration + verification) needs everything landed — the highest-risk step; own it.
- **CP8** (README + 3-min demo script + public repo) can draft in parallel, finalize after CP7.
  Mandatory to submit; it's the Presentation 20%.

## Time budget (11:00 → 4:30 submit)

- 11:00–11:20 CP0
- 11:20–1:00 CP1 / CP2 / CP4 in parallel; CP8 (README/script) drafting starts
- 1:00–1:30 lunch
- 1:30–2:15 CP6 (controller + trace feed)
- 2:15–2:45 CP3 (API glue, starts controller)
- 1:30–3:15 CP5 (overlaps, wire to /state)
- 3:15–4:00 CP7 integration + verification (record known-good demo path)
- 4:00–4:20 CP8 finalize: record 3-min demo, README, push repo public
- 4:20–4:30 Devpost submission (repo URL + video + fields)

## Demo flow (on screen)

1. Open dashboard → the controller is consuming agent traces and detecting prompt/tool waste.
2. A trace with duplicated context and tool reads arrives → controller auto-fires.
3. **Force Compile** (your on-stage moment) → prompt optimizer removes duplicate context, tool
   optimizer removes or merges redundant calls, and the retained calls execute through Zero.
   Model routing and Pomerium policy run afterward as supporting constraints.
4. Eval gate runs → all green → controller ships the measured optimization.
5. Optional: flip one eval red → gate goes red → controller **auto-reverts** to the safe config. Shows
   self-correction live.
6. Watch quality score move on the live timeline; click a dot to inspect its prompt/tool changes.
7. Open **Replay**, select an older iteration, and replay its recorded optimization and gate decision.

## Risk guards

- Fixture fallback on every external call.
- Show only the measured delta from the verified demo run.
