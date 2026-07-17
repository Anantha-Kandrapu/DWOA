# OptiLoop — Build Plan

**A correctness-preserving compiler for agent loops.** Ingests an agent loop, optimizes it
(cheaper model cascade + prompt compression), and refuses to ship any version that fails your
evals — proven by a Buildkite-style eval gate.

> "OptiLoop is a correctness-preserving optimizer — it will never ship a cheaper agent that fails your evals."

## Locked decisions

- **Frontend:** single-file Vite React (`react-ts`), plain `fetch` + `useState`. No TanStack, no router, no query lib.
- **Charts:** Recharts, styled grayscale.
- **Design:** neumorphic, monochrome. Base `#e0e0e0`, dual light/dark soft shadows. Only "accent" = near-black for the hero cost number + passing state. Pass = outset chip + check glyph; fail = inset/pressed chip + cross glyph.
- **Backend:** FastAPI, ~200 lines. Endpoints: `POST /compile`, `GET /evals`, `POST /run`.
- **LLM calls:** MOCKED via fixtures with deterministic outputs (demo-safe). Every external call (LLM, Zero, AgentCore) has a local fixture fallback so the live demo cannot hard-fail.
- **Eval engine:** local mock gate by default; real AWS Bedrock AgentCore Evaluations behind an env flag (`USE_AGENTCORE`). Named as the prod path even when stubbed.
- **No unit tests.** Minimal, heavily commented, prototype-grade.

## Scope

- **Core (must demo):** model cascading + eval gate + before/after cost cards.
- **Real-but-simple:** prompt compression (strip system-prompt bloat, dedupe context).
- **Stretch only:** request coalescing — the "and it also does this" bonus.

## Positioning (the wedge — say this, not "eval-gated optimizer")

AWS Bedrock AgentCore already does eval-gated agent optimization *within* AWS (Evaluations,
prompt/tool Recommendations, A/B promotion, Intelligent Prompt Routing). Do NOT compete with that —
sit on top of it and go where a single vendor structurally won't:

> "OptiLoop compiles any agent loop **across providers** under your **data-governance policy**, and proves it didn't regress."

The moat = **cross-provider cascade (incl. off-AWS to Akash)** + **policy-gated routing (Pomerium)** +
**runtime-agnostic input (ingests a Cursor loop)**. No single vendor ships this.

## Sponsor hooks — go deep on 4, don't bolt on 6

- **Zero.xyz = tool access layer (load-bearing, free, zero-setup).** The agent's "act" step calls
  tools *through* Zero — no API keys, free credit. This is what lets the loop actually *do* things.
  (NOT a pricing feed — earlier framing dropped.)
- **Akash = cheap cascade target.** The downgraded/self-hosted model runs on Akash. This is the
  cross-provider destination AWS won't route you to — the core differentiator. Labeled in the trace.
- **AWS = eval engine + frontier model provider.** Eval gate is Bedrock AgentCore Evaluations (the
  "prod path"); frontier steps served by Bedrock. See CP2 — mock gate by default, real AgentCore
  behind an env flag (needs AWS account/credits; don't let it block the demo).
- **Pomerium = compilation constraint.** Policy blocks PII-touching steps from cascading to an
  external/open model unless authorized. Implement policy logic locally (`policy.json`); layer real
  Pomerium only if time allows.
- **Cursor = input format (bonus).** Loop input is a Cursor-Composer-style JSON so a Cursor judge
  sees their own agent's loop compiled cheaper across providers. Cursor SDK is programmable/headless
  if we want a live ingest.
- **Nexla / Fillmore = skip.** Nexla only fits as an optional data/context source; Fillmore
  (recruiting) has no fit. A bolted-on hook reads worse than none.

## Repo layout

```
optiloop/
  server/
    main.py          # 3 endpoints (CP3)
    optimizer.py     # cascade + compression + policy (CP1)
    router.py        # model choice via Zero pricing + Pomerium policy (CP1)
    evals.py         # eval gate, pass/fail (CP2)
    requirements.txt
  web/
    src/App.tsx      # dashboard: cost cards, bars, eval table, loop trace (CP5)
    src/theme.css    # neumorphic monochrome system (CP4)
  fixtures/
    loop.json        # sample agent loop (Cursor-style)   (CP0)
    evals.json       # ~6 eval cases                        (CP0)
    pricing.json     # Zero pricing snapshot                (CP0)
    policy.json      # Pomerium policy                      (CP0)
  schemas.md         # shared JSON + API contracts          (CP0)
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
   │ optimizer│  │ evals    │   │ design sys │  │ hooks fold │
   │ + router│  │ + gate   │   │ theme.css  │  │ into CP1)  │
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
- **CP3** needs CP1 + CP2.
- **CP5** can start against CP0 contracts immediately (mock fetch), wire to CP3 when ready.

## Time budget (11:00 → 4:30 submit)

- 11:00–11:20 CP0
- 11:20–1:00 CP1 / CP2 / CP4 in parallel
- 1:00–1:30 lunch
- 1:30–2:15 CP3 + sponsor hooks
- 1:30–3:15 CP5 (overlaps)
- 3:15–4:00 integration, real cost numbers, fixture fallbacks
- 4:00–4:30 demo polish + submit

## Demo flow (on screen)

1. Load sample loop → baseline: model, tokens, **$1.84**, evals passing.
2. **Compile** → router picks cheaper model (Zero pricing), compression strips bloat, Pomerium blocks the one PII step from downgrading.
3. Eval gate runs (Buildkite panel) → all green → **$0.22, 100% pass**.
4. Before/After cost cards + grouped bar chart. Money shot.

## Risk guards

- Fixture fallback on every external call.
- Say "up to 80% / measured live" on stage; show the real delta, don't promise a fixed number.
