"""OptiLoop demo API: parallel local iterations with optional Nexla/Akash integrations."""

import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from itertools import cycle
from pathlib import Path
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT.parent / "fixtures"
NEXLA_API_URL = "https://dev-api-express-code.nexla.com"
AKASH_API_URL = "https://console-api.akash.network"
AKASHML_API_URL = "https://api.akashml.com/v1"
AKASHML_MODEL = "zai-org/GLM-5.2"
VARIANTS = (
    ("conservative", False, False),
    ("prompt-first", True, False),
    ("tool-first", False, True),
    ("balanced", True, True),
)


def load_env():
    path = ROOT / ".env"
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()


def secret(*names):
    return next((os.environ.get(name) for name in names if os.environ.get(name)), None)


def request_json(url, method="GET", headers=None, body=None, timeout=8):
    data = json.dumps(body).encode() if body is not None else None
    request = Request(
        url,
        data=data,
        method=method,
        headers={"Accept": "application/json", "User-Agent": "OptiLoop/1.0", **(headers or {})},
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode() or "{}")


def fixture(name):
    with (FIXTURES / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def token_count(text):
    return max(1, round(len(text.split()) * 1.3))


def optimize_prompt(prompt, enabled):
    if not enabled:
        return prompt, []
    seen, kept, removed = set(), [], []
    for line in (line.strip() for line in prompt.splitlines()):
        if not line or line in seen or line.startswith("Optional context:"):
            if line:
                removed.append(line)
            continue
        seen.add(line)
        kept.append(line)
    return "\n".join(kept), removed


def optimize_tools(tools, enabled):
    if not enabled:
        return tools, []
    seen, kept, changes = set(), [], []
    for tool in tools:
        key = (tool["name"], json.dumps(tool.get("args", {}), sort_keys=True))
        if not tool.get("side_effect") and key in seen:
            changes.append({"type": "merge_read", "removed": tool["id"], "summary": f"Merged duplicate {tool['name']}"})
            continue
        seen.add(key)
        kept.append(tool)
    return kept, changes


def step_cost(tokens, model, pricing):
    rates = pricing["models"][model]
    return round((tokens / 1000) * rates["in"] + (tokens * 0.3 / 1000) * rates["out"], 6)


def compile_loop(agent_loop, variant="balanced", prompt_enabled=True, tools_enabled=True):
    pricing, policy = fixture("pricing.json"), fixture("policy.json")
    baseline_steps, optimized_steps, prompt_changes, tool_changes, policy_blocks = [], [], [], [], []

    for step in agent_loop["steps"]:
        prompt = step.get("prompt", step["id"])
        tools = step.get("tools", [])
        baseline_tokens = token_count(prompt)
        baseline_steps.append({
            "id": step["id"], "model": step["model"], "provider": pricing["models"][step["model"]]["provider"],
            "prompt": prompt, "prompt_tokens": baseline_tokens, "tool_calls": len(tools),
            "tools": tools, "cost": step_cost(baseline_tokens, step["model"], pricing),
        })

        optimized_prompt, removed = optimize_prompt(prompt, prompt_enabled)
        optimized_tools, merged = optimize_tools(tools, tools_enabled)
        optimized_tokens = token_count(optimized_prompt)
        model = step["model"]
        if step.get("touches_pii") and policy.get("rules"):
            policy_blocks.append({"step": step["id"], "reason": policy["rules"][0]["reason"], "kept_model": model})
        elif variant == "balanced":
            model = min(pricing["models"], key=lambda item: step_cost(optimized_tokens, item, pricing))

        if removed:
            prompt_changes.append({"type": "dedupe_context", "step": step["id"], "removed": removed, "summary": f"Removed {len(removed)} repeated/optional prompt lines"})
        tool_changes.extend({**change, "step": step["id"]} for change in merged)
        optimized_steps.append({
            "id": step["id"], "model": model, "provider": pricing["models"][model]["provider"],
            "prompt": optimized_prompt, "prompt_tokens": optimized_tokens, "tool_calls": len(optimized_tools),
            "tools": optimized_tools, "cost": step_cost(optimized_tokens, model, pricing), "downgraded": model != step["model"],
        })

    def summary(steps):
        calls = sum(step["tool_calls"] for step in steps)
        return {
            "cost_usd": round(sum(step["cost"] for step in steps), 6),
            "tokens": sum(step["prompt_tokens"] for step in steps),
            "tool_calls": calls,
            "estimated_latency_ms": sum(step["prompt_tokens"] for step in steps) * 2 + calls * 120,
            "steps": steps,
        }

    before, after = summary(baseline_steps), summary(optimized_steps)
    savings = round((1 - after["cost_usd"] / before["cost_usd"]) * 100) if before["cost_usd"] else 0
    return {
        "variant": variant, "baseline": before, "optimized": after, "savings_pct": savings,
        "prompt_optimization": {"tokens_saved": before["tokens"] - after["tokens"], "changes": prompt_changes},
        "tool_optimization": {"calls_saved": before["tool_calls"] - after["tool_calls"], "changes": tool_changes},
        "policy_blocks": policy_blocks,
    }


def run_evals(variant="balanced", fail_ids=()):
    cases = fixture("evals.json")["cases"]
    failed_ids = set(fail_ids)
    if variant == "prompt-first":
        failed_ids.add("e4")  # A visible regression so the score graph moves.
    results = [{"id": case["id"], "status": "fail" if case["id"] in failed_ids else "pass", "ms": 80 + index * 16}
               for index, case in enumerate(cases)]
    failed = sum(item["status"] == "fail" for item in results)
    return {
        "passed": len(results) - failed, "failed": failed, "total": len(results), "cases": results,
        "quality_score": round((len(results) - failed) / len(results) * 100),
        "side_effects_match": True, "gate": "red" if failed else "green", "engine": "local",
    }


loop = fixture("loop.json")
traces = cycle(fixture("traces.json")["traces"])
recent_traces, history, iterations = [], [], []
fail_case = None
lock = threading.Lock()  # ponytail: one process, one shared state, one lock.
integration_state = {
    "nexla": {"configured": bool(secret("NEXLA_TOKEN", "NEXLA_SESSION_TOKEN", "NEXLA_SERVICE_KEY", "NEXLA")), "connected": False},
    "akash": {"configured": bool(secret("AKASH_API_KEY", "AKASH_CONSOLE_API_KEY", "AKASH")), "connected": False},
    "akashml": {"configured": bool(secret("AKASHML_API_KEY", "AKASHML_TOKEN", "AKASHML")), "connected": False},
}
nexla_access_token = None
state_data = {"running": False, "current_config": "baseline", "last_event": None, "compile": None,
              "evals": None, "traces": recent_traces, "history": history, "iterations": iterations,
              "integrations": integration_state}


def safe_call(name, fn):
    try:
        value = fn()
        integration_state[name].update({"connected": True, "error": None})
        return value
    except HTTPError as error:
        hints = {
            ("nexla", 401): "Nexla token expired or service key was rejected",
            ("akash", 403): "Akash Console API key is invalid or lacks deployment-read access",
            ("akashml", 401): "AkashML API key is invalid or expired",
        }
        integration_state[name].update({"connected": False, "error": hints.get((name, error.code), f"HTTP {error.code} {error.reason}")})
        return None
    except (URLError, TimeoutError, ValueError, OSError) as error:
        integration_state[name].update({"connected": False, "error": str(error)[:120]})
        return None


def nexla_token():
    global nexla_access_token
    token = secret("NEXLA_TOKEN", "NEXLA_SESSION_TOKEN")
    if token:
        return token
    if nexla_access_token:
        return nexla_access_token
    service_key = secret("NEXLA_SERVICE_KEY", "NEXLA")
    if not service_key:
        return None
    response = request_json(f"{os.environ.get('NEXLA_API_URL', NEXLA_API_URL).rstrip('/')}/login",
                            method="POST", headers={"Content-Type": "application/json"},
                            body={"service_key": service_key})
    nexla_access_token = response["access_token"]
    return nexla_access_token


def probe_integrations():
    def nexla_probe():
        if integration_state["nexla"]["configured"]:
            safe_call("nexla", lambda: request_json(f"{os.environ.get('NEXLA_API_URL', NEXLA_API_URL).rstrip('/')}/nexla/sources?per_page=1",
                                                      headers={"Authorization": f"Bearer {nexla_token()}", "Accept": "application/json"}))

    def akash_probe():
        key = secret("AKASH_API_KEY", "AKASH_CONSOLE_API_KEY", "AKASH")
        if key:
            safe_call("akash", lambda: request_json(f"{os.environ.get('AKASH_API_URL', AKASH_API_URL).rstrip('/')}/v1/deployments?limit=1",
                                                     headers={"x-api-key": key}))

    def akashml_probe():
        key = secret("AKASHML_API_KEY", "AKASHML_TOKEN", "AKASHML")
        if key:
            models = safe_call("akashml", lambda: request_json(f"{os.environ.get('AKASHML_API_URL', AKASHML_API_URL).rstrip('/')}/models",
                                                                headers={"Authorization": f"Bearer {key}"}))
            if models and models.get("data"):
                integration_state["akashml"]["model"] = models["data"][0]["id"]

    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(lambda fn: fn(), (nexla_probe, akash_probe, akashml_probe)))


def publish_nexla(iteration):
    url = os.environ.get("NEXLA_WEBHOOK_URL")
    if not url:
        return
    telemetry = {key: iteration[key] for key in ("id", "batch_id", "sequence", "ts", "variant", "quality_score", "gate", "decision", "executor", "metrics")}
    telemetry["changes"] = [{"type": item["type"], "step": item.get("step"), "summary": item["summary"]} for item in iteration["changes"]]
    safe_call("nexla", lambda: request_json(url, method="POST",
                                             headers={**({"Authorization": f"Bearer {nexla_token()}"} if integration_state["nexla"]["configured"] else {}),
                                                      "Content-Type": "application/json"},
                                             body={"source": "optiloop", "iteration": telemetry}, timeout=4))


def execute_variant(spec, batch_id):
    name, prompt_enabled, tools_enabled = spec
    compiled = compile_loop(loop, name, prompt_enabled, tools_enabled)
    evaluated = run_evals(name, [fail_case] if fail_case else [])
    after = compiled["optimized"]
    changes = compiled["prompt_optimization"]["changes"] + compiled["tool_optimization"]["changes"]
    return {
        "id": f"iter-{len(iterations) + VARIANTS.index(spec) + 1:04d}", "batch_id": batch_id,
        "sequence": len(iterations) + VARIANTS.index(spec) + 1, "ts": datetime.now(timezone.utc).isoformat(),
        "variant": name, "quality_score": evaluated["quality_score"], "gate": evaluated["gate"],
        "decision": "candidate", "executor": "local-thread",
        "metrics": {"prompt_tokens": after["tokens"], "tool_calls": after["tool_calls"],
                    "estimated_latency_ms": after["estimated_latency_ms"], "cost_usd": after["cost_usd"]},
        "changes": changes, "compile": compiled, "evals": evaluated,
    }


def tick(force=False):
    global fail_case
    with lock:
        trace = {**next(traces), "via": "nexla" if integration_state["nexla"]["connected"] else "fixture"}
        recent_traces.append(trace)
        del recent_traces[:-12]
        batch_id = f"batch-{int(time.time() * 1000)}"
        with ThreadPoolExecutor(max_workers=len(VARIANTS)) as pool:
            batch = list(pool.map(lambda spec: execute_variant(spec, batch_id), VARIANTS))

        passing = [item for item in batch if item["gate"] == "green"]
        winner = min(passing, key=lambda item: (item["metrics"]["cost_usd"], -item["quality_score"])) if passing else batch[0]
        winner["decision"] = "shipped" if passing else "reverted"
        state_data["current_config"] = "optimized" if passing else "baseline"
        iterations.extend(batch)
        del iterations[:-80]
        event = {"ts": winner["ts"], "action": winner["decision"], "variant": winner["variant"],
                 "score": winner["quality_score"], "gate": winner["gate"], "batch_id": batch_id}
        history.append(event)
        del history[:-20]
        state_data.update({"last_event": event, "compile": winner["compile"], "evals": winner["evals"],
                           "traces": recent_traces[-6:], "history": history, "iterations": iterations,
                           "integrations": integration_state})
        threading.Thread(target=publish_nexla, args=(winner,), daemon=True).start()
        return state()


def state():
    return dict(state_data)


def start_controller():
    if state_data["running"]:
        return
    state_data["running"] = True
    threading.Thread(target=probe_integrations, daemon=True).start()

    def run():
        while state_data["running"]:
            tick()
            time.sleep(5)

    threading.Thread(target=run, daemon=True).start()


@asynccontextmanager
async def lifespan(_app):
    start_controller()
    yield


app = FastAPI(title="OptiLoop", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True, "integrations": integration_state}


@app.get("/state")
def get_state():
    return state()


@app.get("/iterations")
def get_iterations():
    return iterations


@app.get("/iterations/{iteration_id}")
def get_iteration(iteration_id: str):
    found = next((item for item in iterations if item["id"] == iteration_id), None)
    if not found:
        raise HTTPException(404, "Iteration not found")
    return found


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
    return run_evals(fail_ids=[fail] if fail else [])


@app.post("/run")
def run_once():
    return tick(force=True)


@app.post("/integrations/akashml")
def akashml_inference(body: dict = Body(default={})):
    key = secret("AKASHML_API_KEY", "AKASHML_TOKEN", "AKASHML")
    if not key:
        raise HTTPException(400, "AKASHML key is not configured")
    model = body.get("model") or os.environ.get("AKASHML_MODEL") or integration_state["akashml"].get("model") or AKASHML_MODEL
    if not model:
        raise HTTPException(400, "Set AKASHML_MODEL or wait for model discovery")
    payload = {"model": model, "messages": [{"role": "user", "content": body.get("prompt", "Optimize this agent prompt.")}],
               "temperature": 0, "max_tokens": body.get("max_tokens", 256)}
    return request_json(f"{os.environ.get('AKASHML_API_URL', AKASHML_API_URL).rstrip('/')}/chat/completions", method="POST",
                        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, body=payload, timeout=30)


@app.post("/sandboxes/akash")
def launch_akash(body: dict = Body(default={})):
    if body.get("confirm") is not True:
        raise HTTPException(400, "Set confirm=true; launching an Akash deployment spends credits")
    key = secret("AKASH_API_KEY", "AKASH_CONSOLE_API_KEY", "AKASH")
    if not key:
        raise HTTPException(400, "AKASH key is not configured")
    if not body.get("sdl"):
        raise HTTPException(400, "SDL is required")
    headers = {"x-api-key": key, "Content-Type": "application/json"}
    base_url = os.environ.get("AKASH_API_URL", AKASH_API_URL).rstrip("/")
    created = request_json(f"{base_url}/v1/deployments", method="POST", headers=headers,
                           body={"data": {"sdl": body["sdl"], "deposit": body.get("deposit", 0.5)}}, timeout=30)
    dseq, manifest = created["data"]["dseq"], created["data"]["manifest"]
    bids = []
    for _ in range(10):
        bids = request_json(f"{base_url}/v1/bids?dseq={dseq}", headers=headers).get("data", [])
        if bids:
            break
        time.sleep(3)
    if not bids:
        return {"status": "waiting_for_bids", "dseq": dseq}
    bid = min(bids, key=lambda item: float(item["bid"]["price"]["amount"]))["bid"]["id"]
    lease = request_json(f"{base_url}/v1/leases", method="POST", headers=headers,
                         body={"manifest": manifest, "leases": [{"dseq": bid["dseq"], "gseq": bid["gseq"],
                                                                  "oseq": bid["oseq"], "provider": bid["provider"]}]}, timeout=30)
    return {"status": "launched", "dseq": dseq, "lease": lease}


if __name__ == "__main__":
    compiled = compile_loop(loop)
    assert compiled["optimized"]["tokens"] <= compiled["baseline"]["tokens"]
    assert compiled["optimized"]["tool_calls"] <= compiled["baseline"]["tool_calls"]
    assert run_evals()["gate"] == "green"
    print("ok")
