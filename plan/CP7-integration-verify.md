# CP7 — Integration + Verification  [highest-risk step; own it]

**Owner:** one agent (ideally whoever finished backend), near the end.
**Depends on:** CP1, CP2, CP3, CP4, CP5, CP6 all landed.
**Files you own:** none new — you wire, run, and fix. May touch any file to fix integration bugs, but coordinate so you don't clobber others.

## Goal
Prove the whole thing runs end-to-end and the live demo can't fail on stage. This is not a unit-test
pass — it's a "does the demo actually work" pass.

## Run everything
```
# backend
cd optiloop/server && pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# frontend (new shell)
cd optiloop/web && npm i && npm run dev   # http://localhost:5173
```

## End-to-end checklist (do in order, fix as you go)
1. Backend boots; controller thread starts; `curl localhost:8000/state` shows `history` growing on its
   own with no other requests. (Autonomy proof works.)
2. Frontend loads, polls `/state`, and labels the trace source accurately.
3. `POST /force-compile` (or the button) → prompt tokens and tool calls decrease; the audit explains
   each removal or merge; latency and cost savings render; gate green; config flips to `optimized`.
4. The prompt audit identifies the exact content removed and preserves required constraints.
5. The tool audit merges duplicate reads and preserves every side-effecting call.
6. Supporting routing and policy decisions appear after the prompt and tool audit.
7. `POST /inject-fail {"case":"e3"}` → gate goes red → controller auto-reverts to baseline → UI shows
   the revert event. Then clear it and confirm it recovers to green.
8. Confirm each controller tick appends one graph dot and its details match the stored snapshot.
9. Replay an older iteration; confirm no endpoint executes tools and live state does not change.
10. Kill the backend, set `USE_MOCK=true` in the frontend → UI still animates a believable autonomous
   loop. (Demo-safe fallback confirmed.)

## Verification / correctness pass
- Confirm `savings_pct` is computed from real math (not hardcoded) and matches the cards + bars.
- Confirm prompt savings come from transformed prompt content, not a fixed multiplier.
- Confirm duplicate read-only tool calls are merged and side-effecting calls are preserved.
- Confirm every external integration falls back safely and is labeled fixture-backed when not live.
- Check the numbers are stable across reloads (deterministic) so the demo is repeatable.
- Confirm the quality-score formula and weights are unchanged across iterations.
- Note the exact measured before/after cost to quote on stage ("up to X%", show the real delta).

## Acceptance
- Every checklist item passes.
- Backend-down fallback confirmed.
- A written "known-good demo path" (the exact click order) handed to whoever presents.
