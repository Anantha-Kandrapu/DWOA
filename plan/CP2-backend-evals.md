# CP2 — Local Behavioral Eval Gate

**Depends on:** CP0
**Files:** `optiloop/server/evals.py`

## Goal

Prove that prompt and tool-plan changes preserve the loop's output and side effects. The evaluator
must not manufacture each case's expected answer.

## Evaluation flow

1. Run the baseline loop against every fixture case.
2. Run the optimized loop against the same case.
3. Apply deterministic, use-case-specific assertions to both outputs.
4. Compare ordered side effects and their arguments.
5. Return a red gate if any assertion fails or side effects differ.

Read-only calls may decrease. Side-effecting calls must match the accepted baseline exactly unless
the use-case contract explicitly permits a change.

## API

- `run_evals(baseline, optimized, fail_ids=())` returns case results, totals,
  `side_effects_match`, and `gate`.
- `quality_score(result)` returns the percentage of weighted assertions passed. Assertion weights
  are fixture-defined and immutable across iterations.
- `gate_blocks_ship(result)` returns `True` unless every case passes and side effects match.
- `fail_ids=["e3"]` remains a deterministic demo hook for showing rollback.

## Acceptance

- The known-good candidate passes every fixture case.
- Removing a required prompt constraint turns the gate red.
- Removing, duplicating, reordering, or changing a side-effecting call turns the gate red.
- The injected failure turns the gate red.
- The same eval result always produces the same quality score.
- The response matches `optiloop/schemas.md`.
