"""FastAPI surface for the OptiLoop demo."""

import json
from pathlib import Path
from typing import Optional

from fastapi import Body, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from controller import controller
from evals import run_evals
from optimizer import compile as compile_loop


FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
app = FastAPI(title="OptiLoop")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def start_controller():
    controller.start()


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/state")
def state():
    return controller.state()


@app.post("/force-compile")
def force_compile():
    return controller.force_compile()


@app.post("/inject-fail")
def inject_fail(body: dict = Body(default={})):
    return controller.inject_fail(body.get("case"))


@app.post("/compile")
def compile_endpoint(loop: Optional[dict] = Body(default=None)):
    if loop is None:
        with (FIXTURES / "loop.json").open() as handle:
            loop = json.load(handle)
    return compile_loop(loop)


@app.get("/evals")
def evals(fail: Optional[str] = None):
    return run_evals(fail_ids=[fail] if fail else ())


@app.post("/run")
def run():
    return {"trace": controller.force_compile()["compile"]["optimized"]["steps"]}
