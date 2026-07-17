# CP6 — Autonomous Controller + Trace Feed

**Owner:** backend agent (after CP1 + CP2 land).
**Depends on:** CP1 (`optimizer.compile`), CP2 (`evals.run_evals`, `gate_blocks_ship`), CP0 (contracts).
**Files you own:** `optiloop/server/controller.py`, `optiloop/server/trace_feed.py`.

## Why this exists
Autonomy is 20% of judging ("acts on real-time data without manual intervention") and it's our
weakest axis. This checkpoint makes DWOA self-directing: observe → detect → compile → eval →
ship or keep-baseline, with no human.

## trace_feed.py
- `stream_traces()` yields traces from `fixtures/traces.json` every ~2 seconds.
- An optional verified live adapter may replace the fixture source.
- Expose `latest_traces(n)` so the API/UI can show the incoming feed.
- Label every trace with its real source.

## controller.py — the self-directing loop
Runs in a background thread/asyncio task started on server boot.
- `tick()` (one iteration):
  1. **Observe:** read the newest agent trace.
  2. **Detect:** mark traces with duplicated prompt content, redundant read-only calls, or excessive
     latency/cost for compilation.
  3. **Act:** call `optimizer.compile(loop)` (prompt + tool optimization; routing and policy afterward).
  4. **Observe again:** `evals.run_evals()`.
  5. **Self-correct:** if `gate_blocks_ship` → keep/revert to the safe (baseline) config and log a
     `reverted` event; else → mark optimized config as `shipped`.
  6. Compute a comparable quality score from weighted eval assertions.
  7. Append an immutable iteration snapshot containing metrics, changes, compile output, eval output,
     action, and gate.
- `state()` → returns current controller state for the API: `running`, `last_event`, `current_config`
  (baseline|optimized), latest `compile` result, latest `evals` result, `history[]`, and the live
  `traces` feed. This is what `GET /state` (CP3) serves.
- `force_compile()` → runs one full tick immediately regardless of threshold — the manual demo moment
  behind `POST /force-compile`.
- `inject_fail(case_id)` → flips an eval case red on the next tick so you can demo auto-revert.

## Loop cadence
- Tick every ~2–3s. Keep it slow enough to watch on stage, fast enough to feel alive.
- Everything in-memory; no DB. Deterministic where possible so numbers are stable on stage.

## Acceptance
- Starting the server starts the controller; `state()` shows events accumulating on their own with no
  requests made.
- `force_compile()` produces a baseline→optimized transition with a green gate and `shipped`.
- `inject_fail("e3")` then a tick shows `red` gate and `reverted`.
- The trace feed visibly includes prompt and tool metrics. Label fixture data accurately.
- Scores use the same formula and weights across every iteration.
- Reading an old iteration never reruns tools or mutates live state.
- Cover ship and keep-baseline behavior in the CP7 end-to-end check.
