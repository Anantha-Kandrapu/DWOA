# CP3 — FastAPI Glue

**Owner:** backend agent (after CP1 + CP2 land, or same agent that finished CP1).
**Depends on:** CP1 (`optimizer.compile`), CP2 (`evals.run_evals`, `gate_blocks_ship`).
**Files you own:** `optiloop/server/main.py`. Do NOT modify optimizer/evals internals — only import them.

## Goal
Wire the three endpoints from `schemas.md`. Thin controller only.

## main.py
- FastAPI app + CORS enabled for `http://localhost:5173` (Vite dev).
- `POST /compile`:
  - Load `fixtures/loop.json` (or accept a posted loop body; default to fixture).
  - Return `optimizer.compile(loop)`.
- `GET /evals`:
  - Accept optional `?fail=e3` query to force a red case (demo).
  - Return `evals.run_evals(fail_ids=...)`.
- `POST /run` (stretch): return a single loop trace using the optimizer's step output.
- Add a `GET /health` → `{"ok": true}`.
- Guarantee endpoint (nice-to-have): `GET /ship-decision` → combines compile + evals and returns
  `{"ship": bool, "reason": str}` using `gate_blocks_ship`. This is the money-line API.

## Run
```
cd optiloop/server && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Acceptance
- `curl localhost:8000/compile` returns the CP0 `/compile` shape.
- `curl localhost:8000/evals` returns green; `curl 'localhost:8000/evals?fail=e3'` returns red.
- CORS lets the Vite app fetch without errors.
- Heavily commented. No unit tests.
