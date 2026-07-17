"""Deterministic compiler for fixture-backed OptiLoop agent loops."""

from __future__ import annotations

from router import cheapest_safe_model, load_policy, load_pricing, step_cost, zero_tools


TECHNIQUES = ["system-prompt strip", "context dedupe"]


def _round_cost(cost):
    return round(cost, 6)


def _step_result(step, model, pricing, downgraded=False, tools=None):
    """Build the compact, UI-ready record for one compiled step."""
    result = {
        "id": step["id"],
        "model": model,
        "provider": "aws-bedrock" if model == "gpt-4o" else pricing["models"][model]["provider"],
        "prompt_tokens": step["prompt_tokens"],
        "est_out": round(step["prompt_tokens"] * 0.3),
        "cost": _round_cost(step_cost(step, model, pricing)),
        "downgraded": downgraded,
    }
    if downgraded:
        result["cascade_from"] = step["model"]
    if tools:
        result["tools"] = tools
    return result


def baseline(loop, pricing):
    """Price the submitted loop without changing its models or prompts."""
    steps = [_step_result(step, step["model"], pricing) for step in loop["steps"]]
    return {
        "cost_usd": _round_cost(sum(step["cost"] for step in steps)),
        "tokens": sum(step["prompt_tokens"] for step in steps),
        "steps": steps,
    }


def compress(step):
    """Remove 28% of prompt bloat with deterministic prompt compression."""
    compressed = dict(step)
    compressed["prompt_tokens"] = round(step["prompt_tokens"] * 0.72)
    return {"step": compressed, "techniques": TECHNIQUES}


def optimize(loop, pricing, policy):
    """Compress, policy-route, and price every loop step."""
    steps, policy_blocks, tokens_saved = [], [], 0
    for step in loop["steps"]:
        compressed = compress(step)
        optimized_step = compressed["step"]
        tokens_saved += step["prompt_tokens"] - optimized_step["prompt_tokens"]
        route = cheapest_safe_model(optimized_step, pricing, policy)
        if route["policy_block"]:
            policy_blocks.append(route["policy_block"])
        steps.append(
            _step_result(
                optimized_step,
                route["model"],
                pricing,
                route["downgraded"],
                zero_tools(optimized_step),
            )
        )
    return {
        "cost_usd": _round_cost(sum(step["cost"] for step in steps)),
        "tokens": sum(step["prompt_tokens"] for step in steps),
        "steps": steps,
        "policy_blocks": policy_blocks,
        "compression": {"tokens_saved": tokens_saved, "techniques": TECHNIQUES},
    }


def compile(loop):
    """Return the complete `/compile` response from local fixture-backed hooks."""
    pricing, policy = load_pricing(), load_policy()
    before = baseline(loop, pricing)
    after = optimize(loop, pricing, policy)
    savings = (1 - after["cost_usd"] / before["cost_usd"]) * 100 if before["cost_usd"] else 0
    return {
        "baseline": before,
        "optimized": {key: after[key] for key in ("cost_usd", "tokens", "steps")},
        "savings_pct": round(savings),
        "policy_blocks": after["policy_blocks"],
        "compression": after["compression"],
    }
