# CP6 — Autonomous Controller + Nexla Feed  [scores the Autonomy 20% + Nexla track]

**Owner:** backend agent (after CP1 + CP2 land).
**Depends on:** CP1 (`optimizer.compile`), CP2 (`evals.run_evals`, `gate_blocks_ship`), CP0 (contracts).
**Files you own:** `optiloop/server/controller.py`, `optiloop/server/nexla.py`. Do NOT touch optimizer/evals internals — only import them.

## Why this exists
Autonomy is 20% of judging ("acts on real-time data without manual intervention") and it's our
weakest axis. This checkpoint makes OptiLoop self-directing: observe → detect → compile → eval →
ship/revert, with no human. It also lands the **Nexla** track (real-time data layer).

## nexla.py — the Nexla ADK real-time feed
- `stream_traces()` → generator/iterator yielding agent traces from `fixtures/traces.json`, one every
  ~2s, to simulate a live Nexla data stream. Each trace = `{loop_id, steps[], observed_cost_usd, ts}`.
- If `os.environ.get("USE_NEXLA")`: pull from the real Nexla ADK instead; wrap in try/except → fall
  back to the fixture stream silently. Never let a live feed break the demo.
- Expose `latest_traces(n)` so the API/UI can show the incoming feed.
- This is the **observe** input. Label the source `via: nexla` so the UI/trace shows it.

## controller.py — the self-directing loop
Runs in a background thread/asyncio task started on server boot.
- `tick()` (one iteration):
  1. **Observe:** read newest trace from `nexla`.
  2. **Detect:** if `observed_cost_usd` exceeds a threshold (or a loop not yet optimized appears),
     mark it for compilation.
  3. **Act:** call `optimizer.compile(loop)` (cascade + compression; tools via Zero; Pomerium gate).
  4. **Observe again:** `evals.run_evals()`.
  5. **Self-correct:** if `gate_blocks_ship` → keep/revert to the safe (baseline) config and log a
     `reverted` event; else → mark optimized config as `shipped`.
  6. Append an event to an in-memory `history` list (timestamp, action, cost_before/after, gate).
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
- Nexla feed visibly streams traces (fixture by default, real ADK behind `USE_NEXLA`).
- Heavily commented. No unit tests.
