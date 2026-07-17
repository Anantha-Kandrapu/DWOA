# CP2 — Eval Gate ("Buildkite")

**Owner:** backend agent B.
**Depends on:** CP0 (fixtures + schemas frozen).
**Files you own:** `optiloop/server/evals.py`. Do NOT touch `main.py`, `optimizer.py`, or `router.py`.

## Goal
Run the eval cases in `fixtures/evals.json` against the (mock) optimized loop and return the
`GET /evals` response from `schemas.md`. This is the correctness gate that makes OptiLoop a
*compiler*, not just a cost cutter.

## Eval engine: mock default, AgentCore behind a flag
- Default: local `mock_run` gate (below). Instant, demo-safe, no AWS account.
- If `os.environ.get("USE_AGENTCORE")`: call AWS Bedrock AgentCore Evaluations instead (Ground Truth
  = each case's `expect`). Wrap in try/except → on ANY failure, fall back to the mock silently.
- In the response, include `"engine": "agentcore" | "mock"` so the UI can show "AWS Bedrock
  AgentCore" as the prod path even when running the mock. Never let a live AWS call break the demo.

## evals.py
- `mock_run(case)`: deterministic fake loop execution. Given `case.input`, produce an output string
  that contains `case.expect` (so the demo passes green). Keep a `FAIL_IDS` toggle (default empty)
  so you can force a red case on demand for the "watch it block a bad optimization" moment.
- `run_evals(fail_ids=())`:
  - For each case: run `mock_run`, check `expect` substring, record `status` (`pass`/`fail`) + a
    deterministic `ms` latency (e.g. 80–160).
  - Aggregate `passed`, `failed`, `total`, and `gate` = `green` if failed==0 else `red`.
- Expose `gate_blocks_ship(result)` → bool: True if gate is red (used by API to refuse shipping the
  cheaper loop). This is the "will never ship a cheaper agent that fails your evals" guarantee.

## Demo hook
- Provide a way to flip one case to fail (`fail_ids=["e3"]`) so on stage you can show: cheaper loop
  proposed → eval gate goes red → OptiLoop refuses to ship → reverts to safe config. Optional but
  strong.

## Acceptance
- `python -c "from evals import run_evals; import json; print(json.dumps(run_evals(),indent=2))"`
  prints 6/6 pass, `gate: green`.
- Passing `fail_ids=["e3"]` yields `gate: red` and `gate_blocks_ship` True.
- Heavily commented. No unit tests.
