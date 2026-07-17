"""Single-file FastAPI demo for OptiLoop."""

import json
import threading
import time
from contextlib import asynccontextmanager
from itertools import cycle
from pathlib import Path
from typing import Optional

from fastapi import Body, FastAPI
from fastapi.middleware.cors import CORSMiddleware


FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
TECHNIQUES = ["system-prompt strip", "context dedupe"]


@asynccontextmanager
async def lifespan(_app):
    start_controller()
    yield


app = FastAPI(title="OptiLoop", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def fixture(name):
    with (FIXTURES / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def step_cost(step, model, pricing):
    rates = pricing["models"][model]
    tokens = step["prompt_tokens"]
    return round((tokens / 1000) * rates["in"] + (tokens * 0.3 / 1000) * rates["out"], 6)


def compiled_step(step, model, pricing, downgraded=False):
    result = {
        "id": step["id"],
        "model": model,
        "provider": pricing["models"][model]["provider"],
        "prompt_tokens": step["prompt_tokens"],
        "est_out": round(step["prompt_tokens"] * 0.3),
        "cost": step_cost(step, model, pricing),
        "downgraded": downgraded,
    }
    if downgraded:
        result["cascade_from"] = step["model"]
    if step.get("role") == "actor" or step.get("id") == "act":
        result["tools"] = [{"tool": "workspace.apply_patch", "via": "zero.xyz"}]
    return result


def choose_model(step, pricing, policy):
    deny = next((rule for rule in policy.get("rules", []) if rule.get("effect") == "deny"), {})
    if step.get("touches_pii") and deny:
        return step["model"], {
            "step": step["id"],
            "reason": deny.get("reason", "PII step cannot cascade"),
            "kept_model": step["model"],
        }
    return min(pricing["models"], key=lambda model: step_cost(step, model, pricing)), None


def compile_loop(loop):
    pricing, policy = fixture("pricing.json"), fixture("policy.json")
    baseline_steps = [compiled_step(step, step["model"], pricing) for step in loop["steps"]]
    optimized_steps, policy_blocks, tokens_saved = [], [], 0

    for step in loop["steps"]:
        optimized = {**step, "prompt_tokens": round(step["prompt_tokens"] * 0.72)}
        tokens_saved += step["prompt_tokens"] - optimized["prompt_tokens"]
        model, block = choose_model(optimized, pricing, policy)
        if block:
            policy_blocks.append(block)
        optimized_steps.append(compiled_step(optimized, model, pricing, model != step["model"]))

    before = {
        "cost_usd": round(sum(step["cost"] for step in baseline_steps), 6),
        "tokens": sum(step["prompt_tokens"] for step in baseline_steps),
        "steps": baseline_steps,
    }
    after = {
        "cost_usd": round(sum(step["cost"] for step in optimized_steps), 6),
        "tokens": sum(step["prompt_tokens"] for step in optimized_steps),
        "steps": optimized_steps,
    }
    savings = round((1 - after["cost_usd"] / before["cost_usd"]) * 100) if before["cost_usd"] else 0
    return {
        "baseline": before,
        "optimized": after,
        "savings_pct": savings,
        "policy_blocks": policy_blocks,
        "compression": {"tokens_saved": tokens_saved, "techniques": TECHNIQUES},
    }


def run_evals(fail_ids=()):
    cases = fixture("evals.json")["cases"]
    failed_ids = set(fail_ids)

    results = []
    for index, case in enumerate(cases):
        output = "failed" if case["id"] in failed_ids else case["expect"]
        results.append({
            "id": case["id"],
            "status": "pass" if case["expect"] in output else "fail",
            "ms": 80 + index * 16,
        })

    failed = sum(result["status"] == "fail" for result in results)
    return {
        "passed": len(results) - failed,
        "failed": failed,
        "total": len(results),
        "cases": results,
        "gate": "red" if failed else "green",
        "engine": "local",
    }


loop = fixture("loop.json")
traces = cycle(fixture("traces.json")["traces"])
recent_traces = []
history = []
state_data = {
    "running": False,
    "current_config": "baseline",
    "last_event": None,
    "compile": None,
    "evals": None,
    "traces": recent_traces,
    "history": history,
}
fail_case = None
lock = threading.Lock()  # ponytail: global lock is enough for this single-process demo.


def tick(force=False):
    global fail_case
    with lock:
        trace = {**next(traces), "via": "nexla"}
        recent_traces.append(trace)
        del recent_traces[:-12]

        result = compile_loop(loop)
        eval_result = run_evals([fail_case] if fail_case else [])
        should_compile = force or trace["observed_cost_usd"] >= 1.84 or state_data["current_config"] == "baseline"
        blocked = eval_result["gate"] == "red"

        if should_compile and not blocked:
            state_data["current_config"] = "optimized"
            action = "shipped"
        elif should_compile:
            state_data["current_config"] = "baseline"
            action = "reverted"
        else:
            action = "observed"

        event = {
            "ts": trace["ts"],
            "action": action,
            "cost_before": result["baseline"]["cost_usd"],
            "cost_after": result["optimized"]["cost_usd"],
            "gate": eval_result["gate"],
        }
        history.append(event)
        del history[:-20]
        state_data.update({
            "last_event": event,
            "compile": result,
            "evals": eval_result,
            "traces": recent_traces[-6:],
            "history": history,
        })
        return state()


def state():
    return dict(state_data)


def start_controller():
    if state_data["running"]:
        return
    state_data["running"] = True

    def run():
        while state_data["running"]:
            tick()
            time.sleep(2)

    threading.Thread(target=run, daemon=True).start()


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/state")
def get_state():
    return state()


@app.post("/force-compile")
def force_compile():
    return tick(force=True)


@app.post("/inject-fail")
def inject_fail(body: dict = Body(default={})):
    global fail_case
    fail_case = body.get("case") or None
    return tick(force=True)


@app.post("/compile")
def compile_endpoint(body: Optional[dict] = Body(default=None)):
    return compile_loop(body or loop)


@app.get("/evals")
def evals(fail: Optional[str] = None):
    return run_evals([fail] if fail else [])


@app.post("/run")
def run_once():
    return {"trace": tick(force=True)["compile"]["optimized"]["steps"]}


if __name__ == "__main__":
    compiled = compile_loop(loop)
    assert compiled["baseline"]["cost_usd"] > compiled["optimized"]["cost_usd"]
    assert run_evals()["gate"] == "green"
    assert run_evals(["e3"])["gate"] == "red"
    print("ok")
