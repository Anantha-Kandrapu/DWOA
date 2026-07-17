# CP0 — Scaffold + Shared Contracts  [BLOCKS ALL]

**Owner:** first agent. Do this before anything else.
**Depends on:** nothing.

## Goal
Create the repo skeleton, all fixtures, and `schemas.md` so every other checkpoint builds against
frozen contracts. Do NOT implement logic here — only structure + data shapes.

## Tasks
1. Create dirs: `optiloop/server`, `optiloop/web/src`, `optiloop/fixtures`, `plan/` (exists).
2. `optiloop/server/requirements.txt`: `fastapi`, `uvicorn`, `pydantic`.
3. Create the 4 fixtures below.
4. Write `optiloop/schemas.md` documenting request/response shapes for `/compile`, `/evals`, `/run`.

## Fixtures

`fixtures/loop.json` — Cursor-Composer-style agent loop:
```json
{
  "name": "code-fix-agent",
  "steps": [
    {"id": "plan",    "role": "planner",  "model": "gpt-4o",      "prompt_tokens": 2400, "touches_pii": false},
    {"id": "read",    "role": "observer", "model": "gpt-4o",      "prompt_tokens": 3100, "touches_pii": true},
    {"id": "edit",    "role": "actor",    "model": "gpt-4o",      "prompt_tokens": 4200, "touches_pii": false},
    {"id": "verify",  "role": "critic",   "model": "gpt-4o",      "prompt_tokens": 1800, "touches_pii": false}
  ]
}
```

`fixtures/pricing.json` — Zero.xyz pricing snapshot ($ per 1k tokens, in/out):
```json
{
  "source": "zero.xyz",
  "models": {
    "gpt-4o":            {"in": 0.005,  "out": 0.015,  "provider": "openai",  "external": true},
    "claude-haiku":      {"in": 0.0008, "out": 0.004,  "provider": "aws-bedrock", "external": true},
    "llama-3-8b-akash":  {"in": 0.0001, "out": 0.0002, "provider": "akash",   "external": false}
  }
}
```

`fixtures/policy.json` — Pomerium policy:
```json
{
  "rules": [
    {"effect": "deny", "when": {"touches_pii": true, "target_external": true},
     "reason": "PII step cannot cascade to external/open model without authorization"}
  ]
}
```

`fixtures/traces.json` — simulated Nexla real-time trace stream (controller's observe input):
```json
{
  "source": "nexla",
  "traces": [
    {"loop_id": "run-101", "ts": "T+0",  "observed_cost_usd": 1.84, "loop_ref": "code-fix-agent"},
    {"loop_id": "run-102", "ts": "T+2s", "observed_cost_usd": 1.91, "loop_ref": "code-fix-agent"},
    {"loop_id": "run-103", "ts": "T+4s", "observed_cost_usd": 2.05, "loop_ref": "code-fix-agent"}
  ]
}
```

`fixtures/evals.json` — ~6 cases (input → expected substring the loop output must contain):
```json
{
  "cases": [
    {"id": "e1", "input": "fix null deref in parser.py",   "expect": "null check"},
    {"id": "e2", "input": "add retry to fetch()",          "expect": "retry"},
    {"id": "e3", "input": "rename var foo to userId",       "expect": "userId"},
    {"id": "e4", "input": "handle empty list case",         "expect": "empty"},
    {"id": "e5", "input": "add type hints to run()",        "expect": "def run"},
    {"id": "e6", "input": "guard divide by zero",           "expect": "zero"}
  ]
}
```

## API contracts (write into schemas.md — FROZEN)

`POST /compile` → returns baseline + optimized side by side:
```json
{
  "baseline":  {"cost_usd": 1.84, "tokens": 11500, "steps": [ {"id":"plan","model":"gpt-4o","cost":0.42} ]},
  "optimized": {"cost_usd": 0.22, "tokens": 6100,  "steps": [ {"id":"plan","model":"llama-3-8b-akash","cost":0.03,"downgraded":true} ]},
  "savings_pct": 88,
  "policy_blocks": [ {"step":"read","reason":"PII step cannot cascade...","kept_model":"gpt-4o"} ],
  "compression": {"tokens_saved": 3200, "techniques": ["system-prompt strip","context dedupe"]}
}
```

`GET /evals` → eval gate result (the "Buildkite" panel):
```json
{"passed": 6, "failed": 0, "total": 6,
 "cases": [ {"id":"e1","status":"pass","ms":120} ],
 "gate": "green"}
```

`GET /state` → the autonomous controller's live state (CP6). Drives the whole dashboard:
```json
{
  "running": true,
  "current_config": "optimized",
  "last_event": {"ts":"T+4s","action":"shipped","cost_before":1.84,"cost_after":0.22,"gate":"green"},
  "compile": { "...": "the /compile shape" },
  "evals":   { "...": "the /evals shape" },
  "traces":  [ {"loop_id":"run-103","observed_cost_usd":2.05,"via":"nexla"} ],
  "history": [ {"ts":"T+2s","action":"observed"}, {"ts":"T+4s","action":"shipped"} ]
}
```

`POST /force-compile` → runs one controller tick immediately (manual demo moment). Returns `/state`.

`POST /inject-fail` body `{"case":"e3"}` → flips one eval red on next tick (demo auto-revert). Returns `/state`.

`POST /run` (optional stretch) → executes one loop, returns trace. Same step shape as `/compile`.

## Acceptance
- All 4 fixtures parse as valid JSON.
- `schemas.md` documents the three endpoints with the shapes above.
- Dirs + `requirements.txt` exist.
