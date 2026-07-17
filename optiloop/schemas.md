# OptiLoop API contracts

All endpoints return JSON. Fixture-backed values keep the demo deterministic.

## `POST /compile`

Accepts an optional loop matching `fixtures/loop.json`. Returns:

```json
{
  "baseline": {"cost_usd": 1.84, "tokens": 11500, "steps": [{"id": "plan", "model": "gpt-4o", "cost": 0.42}]},
  "optimized": {"cost_usd": 0.22, "tokens": 6100, "steps": [{"id": "plan", "model": "llama-3-8b-akash", "cost": 0.03, "downgraded": true}]},
  "savings_pct": 88,
  "policy_blocks": [{"step": "read", "reason": "PII step cannot cascade...", "kept_model": "gpt-4o"}],
  "compression": {"tokens_saved": 3200, "techniques": ["system-prompt strip", "context dedupe"]}
}
```

## `GET /evals`

Returns the eval gate: `{"passed": 6, "failed": 0, "total": 6, "cases": [{"id": "e1", "status": "pass", "ms": 120}], "gate": "green", "engine": "local"}`.

## `GET /state`

Returns the live controller state: `running`, `current_config`, `last_event`, `compile`, `evals`, `traces`, and `history`.

## Controller actions

`POST /force-compile` runs a controller tick and returns `/state`. `POST /inject-fail` accepts `{"case": "e3"}`, makes the next tick fail that eval, and returns `/state`. `POST /run` returns a single fixture-backed loop trace.
