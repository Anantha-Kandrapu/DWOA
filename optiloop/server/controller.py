"""In-memory observe → compile → eval → ship/revert controller."""

import json
import threading
import time
from pathlib import Path

from evals import gate_blocks_ship, run_evals
from nexla import latest_traces, stream_traces
from optimizer import compile as compile_loop


FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


class Controller:
    def __init__(self):
        with (FIXTURES / "loop.json").open() as handle:
            self.loop = json.load(handle)
        self.traces = stream_traces()
        self.history = []
        self.latest_compile = None
        self.latest_evals = None
        self.last_event = None
        self.current_config = "baseline"
        self.fail_ids = set()
        self.running = False
        self._lock = threading.Lock()

    def _event(self, action, trace, result, eval_result):
        event = {
            "ts": trace["ts"],
            "action": action,
            "cost_before": result["baseline"]["cost_usd"],
            "cost_after": result["optimized"]["cost_usd"],
            "gate": eval_result["gate"],
        }
        self.last_event = event
        self.history.append(event)
        del self.history[:-20]

    def tick(self, force=False):
        with self._lock:
            trace = next(self.traces)
            result = compile_loop(self.loop)
            eval_result = run_evals(fail_ids=self.fail_ids)
            should_compile = force or trace["observed_cost_usd"] >= 1.84 or self.current_config == "baseline"
            if should_compile and not gate_blocks_ship(eval_result):
                self.current_config = "optimized"
                action = "shipped"
            elif should_compile:
                self.current_config = "baseline"
                action = "reverted"
            else:
                action = "observed"
            self.latest_compile = result
            self.latest_evals = eval_result
            self._event(action, trace, result, eval_result)
            return self.state()

    def force_compile(self):
        return self.tick(force=True)

    def inject_fail(self, case_id):
        self.fail_ids = {case_id} if case_id else set()
        return self.tick(force=True)

    def state(self):
        return {
            "running": self.running,
            "current_config": self.current_config,
            "last_event": self.last_event,
            "compile": self.latest_compile,
            "evals": self.latest_evals,
            "traces": latest_traces(6),
            "history": self.history,
        }

    def start(self):
        if self.running:
            return
        self.running = True

        def run():
            while self.running:
                self.tick()
                time.sleep(2)

        threading.Thread(target=run, daemon=True).start()


controller = Controller()
