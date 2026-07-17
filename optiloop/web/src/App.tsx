import { useEffect, useMemo, useState } from "react"

const API = "http://localhost:8000"
const USE_MOCK = false

type Step = { id: string; model: string; cost: number; downgraded?: boolean; provider?: string; tools?: Array<{ via: string }> }
type Compile = {
  baseline: { cost_usd: number; steps: Step[] }
  optimized: { cost_usd: number; steps: Step[] }
  savings_pct: number
}
type Eval = { id: string; status: "pass" | "fail"; ms: number }
type Event = { action?: string; event?: string; detail?: string; ts?: string; cost_before?: number; cost_after?: number; gate?: string }
type State = {
  running: boolean
  current_config: "baseline" | "optimized"
  last_event: Event | string | null
  compile: Compile
  evals: { passed: number; failed: number; total: number; cases: Eval[]; gate: "green" | "red"; engine: string }
  history: Event[]
}

const mockCompile: Compile = {
  baseline: { cost_usd: 1.84, steps: [{ id: "plan", model: "gpt-4o", cost: 0.42 }, { id: "read", model: "gpt-4o", cost: 0.51 }, { id: "edit", model: "gpt-4o", cost: 0.63 }, { id: "verify", model: "gpt-4o", cost: 0.28 }] },
  optimized: { cost_usd: 0.22, steps: [{ id: "plan", model: "llama-3-8b-akash", cost: 0.03, downgraded: true, provider: "akash" }, { id: "read", model: "gpt-4o", cost: 0.12 }, { id: "edit", model: "llama-3-8b-akash", cost: 0.04, downgraded: true, provider: "akash", tools: [{ via: "zero.xyz" }] }, { id: "verify", model: "llama-3-8b-akash", cost: 0.03, downgraded: true, provider: "akash" }] },
  savings_pct: 88,
}

const mockState = (): State => ({
  running: true,
  current_config: "optimized",
  last_event: { action: "shipped", cost_before: 1.84, cost_after: 0.22, gate: "green" },
  compile: mockCompile,
  evals: { passed: 6, failed: 0, total: 6, gate: "green", engine: "local", cases: ["e1", "e2", "e3", "e4", "e5", "e6"].map((id, index) => ({ id, status: "pass", ms: 80 + index * 16 })) },
  history: [{ action: "observed", detail: "Nexla trace received" }, { action: "compiled", detail: "Candidate optimized" }, { action: "shipped", detail: "All evals passed" }],
})

const money = (value: number) => `$${value.toFixed(value < 1 ? 3 : 2)}`

export default function App() {
  const [state, setState] = useState<State>(mockState)
  const [failureArmed, setFailureArmed] = useState(false)
  const [busy, setBusy] = useState(false)

  const mergeState = (next: Partial<State>) => {
    setState(current => ({ ...current, ...next, compile: next.compile ?? current.compile, evals: next.evals ?? current.evals }))
  }

  useEffect(() => {
    const refresh = async () => {
      if (USE_MOCK) return
      try {
        mergeState(await fetch(`${API}/state`).then(response => response.json()))
      } catch {
        setState(mockState())
      }
    }
    refresh()
    const timer = window.setInterval(refresh, 1500)
    return () => window.clearInterval(timer)
  }, [])

  const post = async (path: string, body?: unknown) => {
    setBusy(true)
    try {
      if (!USE_MOCK) {
        mergeState(await fetch(`${API}${path}`, {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        }).then(response => response.json()))
      }
    } finally {
      window.setTimeout(() => setBusy(false), 250)
    }
  }

  const baseline = useMemo(() => Object.fromEntries(state.compile.baseline.steps.map(step => [step.id, step])), [state.compile])
  const maxCost = Math.max(...state.compile.baseline.steps.map(step => step.cost), ...state.compile.optimized.steps.map(step => step.cost), 0.01)
  const blocked = state.evals.gate === "red"
  const latest = typeof state.last_event === "string" ? state.last_event : state.last_event?.action ?? state.last_event?.event ?? "ready"

  return (
    <main>
      <header className="topbar">
        <strong>OptiLoop</strong>
        <span className={`pill ${state.running ? "ok" : ""}`}>{state.running ? "Live" : "Paused"}</span>
        <button onClick={() => post("/force-compile")} disabled={busy}>Force compile</button>
      </header>

      <section className="hero">
        <div>
          <span className={`pill ${blocked ? "bad" : "ok"}`}>{blocked ? "Reverted safely" : "Optimized config live"}</span>
          <h1>Cheaper agent loops with an eval gate.</h1>
          <p>OptiLoop watches trace cost, compiles a cheaper route, keeps PII on the safe model, and ships only when evals pass.</p>
        </div>
        <div className="metrics">
          <Metric label="Cost saved" value={`${state.compile.savings_pct}%`} />
          <Metric label="Current route" value={state.current_config} />
          <Metric label="Last event" value={latest} />
        </div>
      </section>

      <section className="grid wide">
        <section className="panel">
          <div className="panel-head">
            <div>
              <small>Cost per step</small>
              <h2>Before / after</h2>
            </div>
            <span className={`pill ${blocked ? "bad" : "ok"}`}>{blocked ? "Gate red" : "Gate green"}</span>
          </div>
          <div className="bars">
            {state.compile.optimized.steps.map(step => (
              <div className="bar-row" key={step.id}>
                <span>{step.id}</span>
                <div className="bar-track"><i style={{ width: `${((baseline[step.id]?.cost ?? 0) / maxCost) * 100}%` }} /></div>
                <div className="bar-track"><b style={{ width: `${(step.cost / maxCost) * 100}%` }} /></div>
                <strong>{money(step.cost)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={`panel decision ${blocked ? "bad-bg" : "ok-bg"}`}>
          <h2>{blocked ? "Baseline restored" : "Safe to ship"}</h2>
          <p>{blocked ? "An eval failed, so the controller kept the safer config." : "Every eval passed after optimization."}</p>
          <strong>{money(state.compile.baseline.cost_usd)} {"->"} {money(state.compile.optimized.cost_usd)}</strong>
        </section>
      </section>

      <section className="grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <small>Eval gate</small>
              <h2>{state.evals.passed}/{state.evals.total} passing</h2>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={failureArmed} onChange={event => {
                setFailureArmed(event.target.checked)
                post("/inject-fail", { case: event.target.checked ? "e3" : "" })
              }} />
              Fail e3
            </label>
          </div>
          <div className="chips">
            {state.evals.cases.map(item => <span className={`pill ${item.status === "pass" ? "ok" : "bad"}`} key={item.id}>{item.id} {item.ms}ms</span>)}
          </div>
        </section>

        <section className="panel">
          <small>Compiler path</small>
          <div className="steps">
            {state.compile.optimized.steps.map(step => (
              <div className="step" key={step.id}>
                <span className={`pill ${step.downgraded ? "route" : ""}`}>{step.id}</span>
                <div>
                  <strong>{step.model}</strong>
                  <small>{step.provider ?? "OpenAI"} {step.tools?.[0]?.via ? `via ${step.tools[0].via}` : ""}</small>
                </div>
                <b>{money(step.cost)}</b>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <small>Trace history</small>
            <h2>Controller timeline</h2>
          </div>
          <button onClick={() => post("/force-compile")} disabled={busy}>Run again</button>
        </div>
        <div className="timeline">
          {state.history.map((event, index) => (
            <div key={`${event.action}-${index}`}>
              <strong>{event.action ?? event.event ?? "event"}</strong>
              <span>{event.detail ?? event.gate ?? "State updated"}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><small>{label}</small><strong>{value}</strong></div>
}
