# OptiLoop API contracts

All endpoints return JSON. Fixture-backed values keep the prototype deterministic, but metrics must
be derived from the submitted loop rather than hardcoded.

## Loop input

Each step contains its prompt and tool plan so the compiler can optimize real content:

```json
{
  "name": "code-fix-agent",
  "steps": [
    {
      "id": "inspect",
      "prompt": "Repository rules...\nIssue...\nRepository rules...",
      "model": "gpt-4o",
      "touches_pii": false,
      "tools": [
        {"id": "read-1", "name": "read_file", "args": {"path": "parser.py"}, "side_effect": false},
        {"id": "read-2", "name": "read_file", "args": {"path": "parser.py"}, "side_effect": false}
      ]
    }
  ]
}
```

## `POST /compile`

Accepts a loop and returns the baseline, optimized candidate, and an audit:

```json
{
  "baseline": {
    "prompt_tokens": 1200,
    "tool_calls": 4,
    "estimated_latency_ms": 900,
    "cost_usd": 0.08,
    "steps": []
  },
  "optimized": {
    "prompt_tokens": 820,
    "tool_calls": 3,
    "estimated_latency_ms": 650,
    "cost_usd": 0.05,
    "steps": []
  },
  "prompt_optimization": {
    "tokens_saved": 380,
    "changes": [{"step": "inspect", "type": "dedupe_context", "removed_tokens": 380}]
  },
  "tool_optimization": {
    "calls_saved": 1,
    "estimated_latency_saved_ms": 250,
    "changes": [{"type": "merge_read", "kept": "read-1", "removed": "read-2"}]
  },
  "policy_blocks": [],
  "savings_pct": 38
}
```

Every tool change must identify the retained and removed calls. Calls with `side_effect: true` may
not be removed, merged, cached, or reordered.

## `GET /evals`

Returns results from running the baseline and optimized loop against the same cases:

```json
{
  "passed": 6,
  "failed": 0,
  "total": 6,
  "cases": [{"id": "e1", "status": "pass", "ms": 120}],
  "side_effects_match": true,
  "gate": "green",
  "engine": "local"
}
```

The gate is green only when all behavioral cases pass and observed side effects match.

## `GET /state`

Returns `running`, `current_config`, `last_event`, `compile`, `evals`, `traces`, `history`, and the
latest iteration snapshots.

## Iterations

Every controller tick stores an immutable snapshot:

```json
{
  "id": "iter-0042",
  "sequence": 42,
  "ts": "2026-07-17T18:42:00Z",
  "quality_score": 83,
  "gate": "green",
  "decision": "shipped",
  "metrics": {
    "prompt_tokens": 820,
    "tool_calls": 3,
    "estimated_latency_ms": 650,
    "cost_usd": 0.05
  },
  "changes": [
    {"type": "dedupe_context", "step": "inspect", "summary": "Removed repeated repository rules"},
    {"type": "merge_read", "step": "inspect", "summary": "Merged duplicate parser.py reads"}
  ],
  "compile": {},
  "evals": {}
}
```

`quality_score` is the percentage of weighted eval assertions passed, from 0 to 100. Its formula and
weights stay fixed across iterations so graph movement is comparable.

- `GET /iterations` returns snapshots ordered by `sequence`.
- `GET /iterations/{id}` returns one recorded snapshot.
- Replay reads snapshots; it never reruns tools or repeats side effects.

## Controller actions

- `POST /force-compile` runs a controller tick and returns `/state`.
- `POST /inject-fail` accepts `{"case": "e3"}`, simulates a regression, and returns `/state`.
- `POST /run` executes one fixture-backed loop and returns its output, tool trace, and side effects.
