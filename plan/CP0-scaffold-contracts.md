# CP0 — Scaffold + Shared Contracts

**Depends on:** nothing
**Blocks:** every implementation checkpoint

## Goal

Freeze the loop, optimization-audit, eval, and controller-state shapes before implementation.

## Tasks

1. Keep `optiloop/server`, `optiloop/web/src`, and `optiloop/fixtures`.
2. Keep backend dependencies limited to `fastapi`, `uvicorn`, and `pydantic`.
3. Create deterministic fixtures for one complete use case.
4. Keep `optiloop/schemas.md` synchronized with the actual API.

## Required loop fixture

`fixtures/loop.json` must contain enough information to optimize real content:

```json
{
  "name": "code-fix-agent",
  "steps": [
    {
      "id": "inspect",
      "role": "observer",
      "model": "gpt-4o",
      "prompt": "Repository rules...\nIssue...\nRepository rules...",
      "touches_pii": false,
      "tools": [
        {"id": "read-1", "name": "read_file", "args": {"path": "parser.py"}, "side_effect": false},
        {"id": "read-2", "name": "read_file", "args": {"path": "parser.py"}, "side_effect": false}
      ]
    },
    {
      "id": "edit",
      "role": "actor",
      "model": "gpt-4o",
      "prompt": "Apply the verified fix once.",
      "touches_pii": false,
      "tools": [
        {"id": "write-1", "name": "write_file", "args": {"path": "parser.py"}, "side_effect": true}
      ]
    }
  ]
}
```

The fixture must include:

- duplicated prompt content that can be removed safely;
- two identical read-only calls that can be merged;
- at least one side-effecting call that must remain unchanged;
- explicit model and policy metadata for the secondary routing pass.

## Other fixtures

- `evals.json`: inputs, expected outputs, and expected side effects.
- `traces.json`: observed token, tool-call, latency, and cost metrics.
- `pricing.json`: optional model-pricing data for secondary routing.
- `policy.json`: constraints that no optimization may violate.

## Frozen API contracts

`schemas.md` defines:

- `POST /compile`: baseline, candidate, prompt audit, tool audit, policy blocks, and derived savings;
- `GET /evals`: behavioral results, side-effect comparison, and gate;
- `GET /state`: autonomous controller state;
- `GET /iterations` and `GET /iterations/{id}`: immutable replay snapshots;
- `POST /force-compile`, `POST /inject-fail`, and `POST /run`.

## Acceptance

- Every fixture parses as valid JSON.
- Prompt and tool-call content—not only aggregate counts—is present.
- Every tool call declares whether it has side effects.
- Iteration fixtures contain a stable sequence, quality score, change summaries, and full snapshots.
- Example API values can be derived from fixture content; no fixed savings percentage is required.
