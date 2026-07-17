"""Fixture-backed routing with visible Zero and Pomerium demo hooks."""

from __future__ import annotations

import json
from pathlib import Path


FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


def _fixture(name):
    """Read local fixtures so the demo never needs a network call."""
    with (FIXTURES / name).open() as fixture:
        return json.load(fixture)


def load_pricing():
    """Return the local pricing-table fallback for the routing hook."""
    return _fixture("pricing.json")


def load_policy():
    """Return the local Pomerium policy fallback."""
    return _fixture("policy.json")


def zero_tools(step):
    """Stub the no-key Zero.xyz tool-access path for actor steps."""
    if step.get("role") != "actor" and step.get("id") != "act":
        return []
    return [{"tool": "workspace.apply_patch", "via": "zero.xyz"}]


def step_cost(step, model, pricing):
    """Use the deterministic 30%-of-prompt output estimate from CP1."""
    tokens = step["prompt_tokens"]
    rates = pricing["models"][model]
    return (tokens / 1000) * rates["in"] + (tokens * 0.3 / 1000) * rates["out"]


def cheapest_safe_model(step, pricing, policy):
    """Choose the lowest-cost permitted model and record Pomerium blocks."""
    original = step["model"]
    deny_rule = next((rule for rule in policy.get("rules", []) if rule.get("effect") == "deny"), None)

    # A PII step has no approved cascade target in this fixture policy: retain its
    # frontier model rather than treating a pricing-table flag as authorization.
    if step.get("touches_pii") and deny_rule:
        return {
            "model": original,
            "downgraded": False,
            "policy_block": {
                "step": step["id"],
                "reason": deny_rule.get("reason", "PII step cannot cascade"),
                "kept_model": original,
            },
        }

    models = pricing["models"]
    ranked = sorted(models, key=lambda model: step_cost(step, model, pricing))
    for model in ranked:
        candidate = models[model]
        blocked = (
            step.get("touches_pii")
            and candidate.get("external")
            and deny_rule
        )
        if not blocked:
            return {"model": model, "downgraded": model != original, "policy_block": None}

    return {"model": original, "downgraded": False, "policy_block": None}
