# CP1 — Prompt + Tool Optimizer

**Owner:** backend agent A.
**Depends on:** CP0 (fixtures + schemas frozen).
**Files you own:** `optiloop/server/optimizer.py`, `optiloop/server/router.py`. Do NOT touch `main.py` or `evals.py`.

## Goal
Given a loop (`fixtures/loop.json`), reduce its prompt tokens and tool calls without changing its
required behavior. Produce baseline and optimized plans exactly as defined in `schemas.md`.

## Prompt optimization
- Remove repeated instructions and duplicate context.
- Remove history that no later step references.
- Preserve policy, safety, output-format, and task requirements verbatim.
- Report tokens before/after and every transformation applied.

## Tool optimization
- Remove tool results that are never consumed.
- Merge identical reads or searches with the same arguments.
- Reuse a result within the same run when the tool is read-only.
- Never cache, merge, or remove calls with side effects.
- Report calls before/after, calls removed or merged, and estimated latency saved.

## router.py — supporting infrastructure
- `load_pricing()` → read `fixtures/pricing.json` (local pricing table; fixture fallback).
- `load_policy()` → read `fixtures/policy.json` (Pomerium hook).
- `zero_tools(step)` → execute the retained tool plan through Zero and label it `via: zero.xyz`.
- `cheapest_safe_model(step, pricing, policy)`:
  - Rank models by cost ascending.
  - For each, check policy: if `step.touches_pii` and candidate `external` is true and a `deny` rule matches → skip it (record the block).
  - Return chosen model + whether it was `downgraded` + any `policy_block`.
- Cost of a step = `(prompt_tokens/1000)*in + (est_out/1000)*out`. Use `est_out = prompt_tokens*0.3` for a deterministic demo number.

## optimizer.py
- `baseline(loop, pricing)`: every step stays on its original model; sum costs/tokens.
- `compress(step)`: apply explicit prompt transformations and calculate the resulting token count.
- `optimize_tools(loop)`: return a safe, smaller tool plan plus an audit of each change.
- `optimize(loop, pricing, policy)`:
  1. optimize prompts,
  2. optimize tool plans,
  3. route models as a secondary pass,
  4. collect prompt, tool, policy, latency, and cost summaries.
- `compile(loop)`: returns the full `/compile` response dict (baseline + optimized + savings_pct + policy_blocks + compression).

## Supporting hooks
- Pomerium: the `read` step touches PII, so it must be BLOCKED from cascading and kept on `gpt-4o`. `policy_blocks` must contain it. This is the demo's proof Pomerium is load-bearing.
- Zero.xyz: the "act" step's tool calls route via `zero_tools()`; trace shows `via: zero.xyz`.
- Akash: an optional cheap cascade target after prompt and tool optimization.
- OpenAI: frontier steps carry `provider: openai`; the eval gate (CP2) is local.

## Acceptance
- `python -c "from optimizer import compile; import json; print(json.dumps(compile(json.load(open('../fixtures/loop.json'))),indent=2))"` prints a valid `/compile` response.
- Prompt and tool reductions are derived from the actual plans, not hardcoded percentages.
- Side-effecting tool calls are unchanged.
- Duplicate read-only calls are merged and visible in the optimization audit.
- The PII `read` step appears in `policy_blocks` and stays on gpt-4o.
- Heavily commented. No unit tests.
