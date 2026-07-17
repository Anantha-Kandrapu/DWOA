# CP3 — FastAPI Glue

**Owner:** backend agent (after CP1 + CP2 + CP6 land).
**Depends on:** CP1 (`optimizer.compile`), CP2 (`evals.run_evals`, `gate_blocks_ship`), CP6 (`controller`).
**Files you own:** `optiloop/server/main.py`. Do NOT modify optimizer/evals/controller internals — only import them.

## Goal
Wire the endpoints from `schemas.md`. Keep the controller thin.

## main.py
- FastAPI app + CORS enabled for `http://localhost:5173` (Vite dev).
- On startup: start the CP6 controller background loop.
- `GET /state`: return `controller.state()`. **Primary endpoint** — the dashboard polls this (~1–2s).
- `GET /iterations`: return immutable iteration summaries in sequence order.
- `GET /iterations/{id}`: return the recorded snapshot used by Replay.
- `POST /force-compile`: call `controller.force_compile()`, return `/state`. The on-stage moment.
- `POST /inject-fail` (body `{"case":"e3"}`): call `controller.inject_fail(...)`, return `/state`. Demo auto-revert.
- `POST /compile`: load `fixtures/loop.json` (or posted body), return `optimizer.compile(loop)`. (Direct/manual path.)
- `GET /evals`: optional `?fail=e3`, return `evals.run_evals(fail_ids=...)`.
- `GET /health` → `{"ok": true}`.
- `POST /run`: execute one fixture-backed loop and return output, tool trace, and side effects.

## Run
```
cd optiloop/server && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Acceptance
- `curl localhost:8000/state` returns the CP0 `/state` shape and its `history` grows on its own
  (controller running) with no other requests.
- `curl -X POST localhost:8000/force-compile` shows a baseline→optimized transition, gate green.
- `curl -X POST localhost:8000/inject-fail -d '{"case":"e3"}'` → next state shows red gate + reverted.
- Iteration endpoints return old snapshots without executing tools or changing controller state.
- CORS lets the Vite app fetch without errors.
- The CP7 end-to-end check exercises every endpoint.
