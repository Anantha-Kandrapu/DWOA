"""Fixture-backed Nexla trace feed used when no live integration is configured."""

import json
from pathlib import Path


FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
_recent = []


def stream_traces():
    """Yield the deterministic trace stream forever so the dashboard stays alive."""
    with (FIXTURES / "traces.json").open() as handle:
        traces = json.load(handle)["traces"]
    while True:
        for trace in traces:
            event = {**trace, "via": "nexla"}
            _recent.append(event)
            del _recent[:-12]
            yield event


def latest_traces(count=6):
    return _recent[-count:]
