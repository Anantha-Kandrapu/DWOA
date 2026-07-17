# DWOA — 3-Minute Demo Script

**Target duration:** 2:45  
**Status:** use only after CP7 records a verified baseline and optimized run.

## 0:00–0:20 — Problem

**Show:** the baseline agent trace.

> Agent loops waste money beyond model choice. They repeat instructions, carry irrelevant context,
> and call the same tools more than once. DWOA optimizes prompts and tool plans, then proves the
> new loop still works.

## 0:20–0:50 — Baseline

**Show:** prompt tokens, tool calls, latency, and cost for the selected use case.

> This baseline repeats context across steps and performs duplicate read-only calls. The final
> action changes external state, so it must remain untouched.

## 0:50–1:35 — Compile

**Show:** click **Force Compile**, then open the optimization audit.

> DWOA removes duplicated prompt content, keeps required constraints, merges identical
> read-only calls, and reuses results only while their dependencies remain unchanged. It never
> removes or merges side-effecting calls. Model routing and policy checks run afterward as supporting
> infrastructure.

## 1:35–2:15 — Prove correctness

**Show:** the baseline and candidate running against the same eval cases.

> Savings do not ship on their own. The candidate must preserve the expected output and side
> effects. These evals pass, so DWOA ships it. Now I inject a regression: the gate turns red and
> the controller keeps the known-good baseline.

## 2:15–2:45 — Result

**Show:** the live score timeline, click the latest dot, then replay one older iteration.

> DWOA is a correctness-preserving compiler for agent loops. It reduces prompt tokens and tool
> calls, protects side effects, and ships only verified optimizations. Every iteration is inspectable
> and replayable without rerunning its side effects.

## Recording checklist

- Show one use case end to end; do not mix unrelated examples.
- Display measured values from the verified run, not `$1.84`, `$0.22`, or a fixed savings claim.
- Show the prompt diff and tool-plan audit, not only aggregate cost.
- State clearly when Zero, Nexla, Pomerium, Akash, or any other integration is fixture-backed.
- Do not claim a recording, public repository, or live integration until it has been verified.
