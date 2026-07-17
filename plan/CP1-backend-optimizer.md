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
- Derive model cost from the optimized prompt token count; routing remains a secondary pass.

## optimizer.py
- `baseline(loop, pricing)`: preserve original prompts and tool plans; derive tokens, calls, latency,
  and cost.
- `compress(step)`: apply explicit prompt transformations and calculate the resulting token count.
- `optimize_tools(loop)`: return a safe, smaller tool plan plus an audit of each change.
- `optimize(loop, pricing, policy)`:
  1. optimize prompts,
  2. optimize tool plans,
  3. route models as a secondary pass,
  4. collect prompt, tool, policy, latency, and cost summaries.
- `compile(loop)`: returns the full response in `schemas.md`, including prompt and tool audit trails.

## Supporting hooks
- Pomerium: an optional policy adapter may block a sensitive step from external routing.
- Zero.xyz: retained tool calls may execute through `zero_tools()` when the integration is verified.
- Akash: an optional cheap cascade target after prompt and tool optimization.
- OpenAI: frontier steps carry `provider: openai`; the eval gate (CP2) is local.

## Acceptance
- Compiling `fixtures/loop.json` produces a response matching `schemas.md`.
- Prompt and tool reductions are derived from the actual plans, not hardcoded percentages.
- Side-effecting tool calls are unchanged.
- Duplicate read-only calls are merged and visible in the optimization audit.
- Policy-blocked steps remain unchanged.
- Leave one deterministic compiler check covering prompt preservation and tool side effects.
