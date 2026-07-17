# CP8 — Submission

**Depends on:** CP7 verified metrics and demo path
**Files:** `README.md`, `DEMO_SCRIPT.md`

## README

Lead with:

> OptiLoop removes wasted prompt tokens and tool calls, then proves the optimized agent still works.

The README must explain:

- the prompt and tool waste being solved;
- the side-effect safety rule;
- the eval-backed ship or rollback decision;
- model routing and policy as supporting infrastructure;
- exact local run commands;
- which integrations are live and which are fixture-backed.

Do not present model routing as the product.

## Demo

Target 2:45:

- **0:00–0:20:** show repeated context and duplicate tool calls in one baseline trace.
- **0:20–0:50:** show baseline prompt tokens, tool calls, latency, and cost.
- **0:50–1:35:** compile; inspect the prompt diff and tool audit.
- **1:35–2:15:** run the same behavioral evals; inject a regression and show rollback.
- **2:15–2:45:** show the live score timeline, inspect a dot, and replay an older iteration.

Never use fixed before/after numbers unless CP7 produced them. Never call a fixture-backed sponsor
integration live.

## Repository and submission

- Ignore `node_modules`, `.venv`, `dist`, and `__pycache__`.
- Confirm the repository and recording links work while logged out.
- Complete every required submission field before the deadline.

## Acceptance

- README and demo use prompt/tool optimization as the primary story.
- The demo shows an inspectable prompt diff and tool-plan audit.
- The demo shows the live iteration graph and a side-effect-free replay.
- Metrics match the verified run.
- Side effects and eval behavior are visible.
- Public links work.
