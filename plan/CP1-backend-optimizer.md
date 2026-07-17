# CP1 — Optimizer + Router (+ sponsor hooks)

**Owner:** backend agent A.
**Depends on:** CP0 (fixtures + schemas frozen).
**Files you own:** `optiloop/server/optimizer.py`, `optiloop/server/router.py`. Do NOT touch `main.py` or `evals.py`.

## Goal
Given a loop (`fixtures/loop.json`) produce the `baseline` and `optimized` objects exactly as
defined in `schemas.md`. This is where cascading, compression, and the two sponsor hooks live.

## router.py
- `load_pricing()` → read `fixtures/pricing.json` (local pricing table; fixture fallback).
- `load_policy()` → read `fixtures/policy.json` (Pomerium hook).
- `zero_tools(step)` → the **Zero.xyz** hook: the agent's "act" step gets its tools/APIs through
  Zero's no-key layer (free). For the demo, return a stubbed list of tool calls routed via Zero and
  label them `via: zero.xyz` in the trace. Real Zero install can slot in later. Zero is tool access,
  NOT a pricing feed.
- `cheapest_safe_model(step, pricing, policy)`:
  - Rank models by cost ascending.
  - For each, check policy: if `step.touches_pii` and candidate `external` is true and a `deny` rule matches → skip it (record the block).
  - Return chosen model + whether it was `downgraded` + any `policy_block`.
- Cost of a step = `(prompt_tokens/1000)*in + (est_out/1000)*out`. Use `est_out = prompt_tokens*0.3` for a deterministic demo number.

## optimizer.py
- `baseline(loop, pricing)`: every step stays on its original model; sum costs/tokens.
- `compress(step)`: real-but-simple — knock ~28% off `prompt_tokens` (strip system-prompt bloat + context dedupe). Return new token count + techniques list. Keep it honest and simple.
- `optimize(loop, pricing, policy)`:
  1. compress each step,
  2. route each step to `cheapest_safe_model`,
  3. sum optimized cost/tokens,
  4. collect `policy_blocks` and `compression` summary.
- `compile(loop)`: returns the full `/compile` response dict (baseline + optimized + savings_pct + policy_blocks + compression).

## Sponsor hooks — must be visible in output
- Pomerium: the `read` step touches PII, so it must be BLOCKED from cascading and kept on `gpt-4o`. `policy_blocks` must contain it. This is the demo's proof Pomerium is load-bearing.
- Zero.xyz: the "act" step's tool calls route via `zero_tools()`; trace shows `via: zero.xyz`.
- Akash: the cheap cascade target — chosen cheap models carry `provider: akash` so the trace shows "gpt-4o → llama-3-8b-akash". This is the cross-provider move (off-AWS) that is OptiLoop's moat.
- AWS: frontier steps carry `provider: aws-bedrock`; the eval gate (CP2) is AgentCore.

## Acceptance
- `python -c "from optimizer import compile; import json; print(json.dumps(compile(json.load(open('../fixtures/loop.json'))),indent=2))"` prints a valid `/compile` response.
- `savings_pct` is meaningfully high (~80s) but derived from real math, not hardcoded.
- The PII `read` step appears in `policy_blocks` and stays on gpt-4o.
- Heavily commented. No unit tests.
