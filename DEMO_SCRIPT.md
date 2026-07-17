# OptiLoop — 3-Minute Demo Script

**Target duration:** 2:45.
**Recording status:** not yet recorded. Use this script only after CP7 verifies the known-good demo path.

## Before recording

- Run the CP7 end-to-end checklist and keep the dashboard in its verified starting state.
- Record at 1280×720 or higher, with a visible cursor and legible cost and eval values.
- Keep the dashboard open with the autonomous loop already running.
- Do a dry run and leave margin below the three-minute limit.

## 0:00–0:20 — Hook

**Show:** the OptiLoop dashboard.

**Say:**

> Every team is burning money running agents on frontier models. OptiLoop compiles any agent loop across providers under policy, then proves it did not regress before shipping the cheaper route.

## 0:20–0:50 — Autonomous observe and detect

**Show:** the running controller, incoming Nexla traces and metrics, and a cost spike arriving without a click.

**Say:**

> This loop is already running on its own. OptiLoop observes real-time agent traces and cost metrics through Nexla, detects an expensive loop, and begins the optimization cycle without waiting for a human operator. That observe, detect, compile, eval, ship-or-revert cycle is the core of the product.

## 0:50–1:40 — Force Compile and the cost change

**Show:** click **Force Compile**. Follow the compilation trace, routing decision, policy block, tool trace, and cost cards.

**Say:**

> For the stage demo, I can force the same compilation cycle. The baseline run costs $1.84. OptiLoop compresses prompt bloat and cascades eligible steps to a cheaper cross-provider model on Akash, targeting about $0.22 after optimization. But it does not blindly downgrade everything: Pomerium policy keeps the PII-touching step on the safe frontier model. And when the agent acts, its tool calls run through Zero's no-key access layer.

## 1:40–2:15 — Eval gate and self-correction

**Show:** first show a green eval gate and the optimized configuration shipping. Then inject the verified failing case and show the red gate plus automatic revert.

**Say:**

> A lower cost is not enough. The local deterministic eval gate must pass before OptiLoop ships. Here all evals pass, so the cheaper configuration ships. Now I inject a failing case. The gate turns red and OptiLoop automatically returns to the safe baseline. It will never ship a cheaper agent that fails your evals.

## 2:15–2:45 — Close

**Show:** the final state, cost comparison, and routing trace.

**Say:**

> OptiLoop is a governance-aware compiler for agent loops: it observes runtime behavior, optimizes across providers, keeps policy-sensitive work safe, and continuously proves correctness before it saves money. That is why Zero, Pomerium, Nexla, Akash, and a Cursor-style input format are all load-bearing parts of one autonomous system.

## Do not claim until verified

- Do not state that the displayed cost reduction is final until CP7 has measured it end to end.
- Do not state that Nexla, Zero, or Akash is live if the deterministic fixture fallback is running; describe the fallback accurately.
- Do not claim a recording, screenshots, public GitHub repository, or Devpost submission exists until each has been completed and checked.
