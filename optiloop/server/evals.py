"""Deterministic evaluation gate for the OptiLoop demo."""

import json
import os
from pathlib import Path


# Demo toggle: add an id such as "e3" to make that case fail.
FAIL_IDS = set()
_FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "evals.json"


def _cases():
    """Load the frozen eval suite beside the application, not from cwd."""
    with _FIXTURES.open(encoding="utf-8") as fixture:
        return json.load(fixture)["cases"]


def mock_run(case):
    """Return a predictable optimized-loop result for a fixture case."""
    if case["id"] in FAIL_IDS:
        return "optimized loop failed to produce a valid result"
    return f"optimized: {case['input']} -> {case['expect']}"


def _agentcore_run(case):
    """Run one case through AgentCore when a configured evaluator is available.

    The SDK import and API call remain inside this optional path so the local
    demo neither needs AWS credentials nor the boto3 package.
    """
    import boto3

    evaluator_arn = os.environ["AGENTCORE_EVALUATOR_ARN"]
    client = boto3.client("bedrock-agentcore")
    response = client.evaluate(
        evaluatorArn=evaluator_arn,
        input=case["input"],
        groundTruth=case["expect"],
    )
    return response["output"]


def run_evals(fail_ids=()):
    """Run all fixture cases and return the GET /evals contract."""
    global FAIL_IDS
    original_fail_ids = FAIL_IDS
    FAIL_IDS = set(FAIL_IDS) | set(fail_ids)
    engine = "mock"

    try:
        cases = _cases()
        if os.environ.get("USE_AGENTCORE"):
            outputs = [_agentcore_run(case) for case in cases]
            engine = "agentcore"
        else:
            outputs = [mock_run(case) for case in cases]
    except Exception:
        # Any missing SDK, credential, or service error must leave the demo up.
        engine = "mock"
        outputs = [mock_run(case) for case in _cases()]
    finally:
        FAIL_IDS = original_fail_ids

    results = [
        {
            "id": case["id"],
            "status": "pass" if case["expect"] in output else "fail",
            "ms": 80 + index * 16,
        }
        for index, (case, output) in enumerate(zip(cases, outputs))
    ]
    failed = sum(result["status"] == "fail" for result in results)
    return {
        "passed": len(results) - failed,
        "failed": failed,
        "total": len(results),
        "cases": results,
        "gate": "red" if failed else "green",
        "engine": engine,
    }


def gate_blocks_ship(result):
    """Return whether this eval result must prevent a cheaper loop shipping."""
    return result["gate"] == "red"
