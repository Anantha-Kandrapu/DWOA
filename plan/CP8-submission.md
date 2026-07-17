# CP8 — Submission: README + 3-min Demo Script + Public Repo  [mandatory to submit]

**Owner:** one agent, in parallel with CP7 (can draft while others build).
**Depends on:** CP7 for the final numbers + known-good demo path.
**Files you own:** `README.md` (repo root), `DEMO_SCRIPT.md`.

## Why
Devpost requires a **3-minute demo recording** + a **public GitHub repo**. This is 20% (Presentation)
and is the gate to even being judged. Do not leave it to the last 10 minutes.

## README.md (repo root) — judges read this
- One-liner + the wedge: "OptiLoop compiles any agent loop across providers under your governance
  policy, and proves it didn't regress."
- **What it does** (3–4 sentences): autonomous observe→compile→eval→ship/revert loop.
- **Sponsor tools used** (this is the Tool Use 20% — be explicit and concrete):
  - Zero.xyz — agent's act step runs tools through Zero's no-key layer.
  - Pomerium — policy-gated routing: PII steps can't cascade to external/open models.
  - Nexla — real-time trace/metric feed into the observe step.
  - AWS — Bedrock AgentCore Evaluations as the eval gate (prod path); Bedrock for frontier steps.
  - Akash — cheap cascaded model target. Cursor — input loop format.
- **Architecture** — the tiny diagram + the loop.
- **Run it** — the exact commands from CP7.
- **Screenshots/GIF** of the dashboard.

## DEMO_SCRIPT.md — beat-by-beat 3-minute recording
Target 2:45 to leave margin. Beats:
- **0:00–0:20** Hook: "Every team is burning money running agents on frontier models. AWS optimizes
  within Bedrock — but it'll never route you off AWS, and it won't stop a PII step from leaking to an
  open model. OptiLoop does both."
- **0:20–0:50** Show the dashboard already running autonomously — Nexla feed ticking, controller
  acting with no clicks. (Autonomy.)
- **0:50–1:40** Force Compile: baseline $1.84 → $0.22, cross-provider cascade to Akash, Pomerium
  blocks the PII step live, Zero powering tool calls. (Tool Use + the money shot.)
- **1:40–2:15** Inject Fail → gate red → auto-revert. "It will never ship a cheaper agent that fails
  your evals." (Self-correction.)
- **2:15–2:45** Close: the one-liner + which sponsor tracks it hits.
- Record at 1280x720+, quiet room, cursor visible, numbers legible. Do a dry run first.

## Repo public
- `.gitignore` for `node_modules`, `.venv`, `dist`, `__pycache__`.
- Commit everything, push, set repo **public**. Confirm it loads logged-out.
- Paste repo URL + video link into Devpost with all required fields before 4:30.

## Acceptance
- README renders, names all sponsor tools concretely, has run instructions + a visual.
- 3-min recording exists, under 3:00, shows the autonomous loop + force compile + auto-revert.
- Repo is public and loads in an incognito window.
- Devpost submission complete before the deadline.
