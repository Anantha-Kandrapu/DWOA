import { useEffect, useState } from "react"

const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001"
const example = "Refund order ORD-1042 for customer CUST-88 only when it is damaged or late. Never issue a duplicate refund. Verify the refund policy and notify the customer after approval."

type Change = { type: string; step?: string; summary: string }
type Tool = { id: string; name: string }
type JudgeCase = { id: string; name: string; status: "pass" | "fail"; score: number; reason: string }
type Iteration = {
  id: string
  sequence: number
  variant: string
  executor: string
  model: string
  optimized_prompt: string
  probe_output: string
  quality_score: number
  gate: "green" | "red"
  decision: string
  changes: Change[]
  metrics: {
    input_tokens: number
    output_tokens: number
    actual_latency_ms: number
    cost_usd: number
    experiment_cost_usd: number
    optimization_input_tokens: number
    optimization_output_tokens: number
    evaluation_input_tokens: number
    evaluation_output_tokens: number
    measurement: string
    price_source: string
  }
  compile: { optimized: { steps: Array<{ tools?: Tool[] }> } }
  evals: { engine: string; cases: JudgeCase[] }
}
type State = {
  iterations: Iteration[]
  optimization_running: boolean
  run_error?: string
  workflow_input?: string
  sessions: SessionSummary[]
  target_iterations: number
}
type SessionSummary = { id: string; workflow_id: string; completed_at: string; status: string; iteration_count: number }
type Session = SessionSummary & { workflow_input?: string; iterations: Iteration[] }

const money = (value: number) => `$${value.toFixed(6)}`

export default function App() {
  const [state, setState] = useState<State | null>(null)
  const [workflow, setWorkflow] = useState(example)
  const [selectedId, setSelectedId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [view, setView] = useState<"live" | "history">("live")
  const [session, setSession] = useState<Session | null>(null)

  const refresh = async () => {
    const response = await fetch(`${API}/state`)
    if (!response.ok) throw new Error("DWOA API is unavailable")
    setState(await response.json())
  }

  useEffect(() => {
    refresh().catch(() => undefined)
    const timer = window.setInterval(() => refresh().catch(() => undefined), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const run = async () => {
    setSubmitting(true)
    try {
      const response = await fetch(`${API}/run-iterations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 20, workflow }),
      })
      const next = await response.json()
      if (!response.ok) throw new Error(next.detail ?? "Run failed")
      setState(next)
      setSelectedId("")
      setView("live")
    } catch (error) {
      setState(current => ({ ...(current ?? { iterations: [], optimization_running: false, sessions: [], target_iterations: 20 }), run_error: String(error) }))
    } finally {
      setSubmitting(false)
    }
  }

  const iterations = state?.iterations ?? []
  const selected = iterations.find(item => item.id === selectedId) ?? iterations[iterations.length - 1]
  const running = Boolean(state?.optimization_running)
  const target = state?.target_iterations || 20

  return <main>
    <header className="topbar">
      <strong className="brand">DWOA <span>Dynamic Workflow Optimization Agent</span></strong>
      <span className={`pill ${running ? "" : "ok"}`}>{running ? `Running ${iterations.length}/${target}` : "Ready"}</span>
    </header>

    <section className="panel workflow-form">
      <div>
        <small>Workflow input</small>
        <h1>Give DWOA a use case</h1>
        <p>This exact text is sent to real Akash sandbox jobs. Each job calls AkashML to produce and judge a workflow variation.</p>
      </div>
      <textarea aria-label="Workflow use case" value={workflow} onChange={event => setWorkflow(event.target.value)} />
      <button onClick={run} disabled={running || submitting || workflow.trim().length < 20}>
        {running || submitting ? `Running ${iterations.length}/${target}…` : "Run 20 iterations"}
      </button>
    </section>

    {state?.run_error && <section className="panel error"><strong>Run failed</strong><span>{state.run_error}</span></section>}

    <nav className="tabs">
      <button className={view === "live" ? "active" : ""} onClick={() => setView("live")}>Live</button>
      <button className={view === "history" ? "active" : ""} onClick={() => setView("history")}>Previous runs</button>
    </nav>

    {view === "live" ? <>
    <section className="live-head">
      <div><small>Live</small><h2>Prompt and tool variations</h2></div>
      <span>{iterations.length}/{target} finished</span>
    </section>

    <IterationBrowser iterations={iterations} selected={selected} select={setSelectedId} empty={running ? "Waiting for the first Akash iteration…" : "Enter a use case and start a run."} />
    </> : <History sessions={state?.sessions ?? []} selected={session} setSelected={setSession} />}
  </main>
}

function History({ sessions, selected, setSelected }: { sessions: SessionSummary[]; selected: Session | null; setSelected: (session: Session) => void }) {
  const open = async (id: string) => setSelected(await fetch(`${API}/sessions/${id}`).then(response => response.json()))
  const selectedIteration = selected?.iterations[selected.iterations.length - 1]
  return <section className="history-layout">
    <aside className="panel session-list">
      <small>Completed workflows</small>
      {sessions.length === 0 && <p>No previous runs yet.</p>}
      {sessions.map(item => <button className={selected?.id === item.id ? "active" : ""} onClick={() => open(item.id)} key={item.id}>
        <b>{item.workflow_id}</b><span>{item.iteration_count} iterations · {item.status}</span><span>{new Date(item.completed_at).toLocaleString()}</span>
      </button>)}
    </aside>
    <section>
      {!selected && <section className="panel"><p>Select a previous workflow to see every iteration and change.</p></section>}
      {selected && <>
        <section className="panel history-workflow"><small>Original workflow input</small><p>{selected.workflow_input ?? "This older run did not record its workflow input."}</p></section>
        <IterationBrowser iterations={selected.iterations} selected={selectedIteration} select={() => undefined} empty="No iterations recorded." />
      </>}
    </section>
  </section>
}

function IterationBrowser({ iterations, selected, select, empty }: { iterations: Iteration[]; selected?: Iteration; select: (id: string) => void; empty: string }) {
  const [localId, setLocalId] = useState("")
  const active = iterations.find(item => item.id === localId) ?? selected ?? iterations[iterations.length - 1]
  const choose = (id: string) => { setLocalId(id); select(id) }
  return <section className="live-grid">
    <aside className="panel iteration-list">
      {iterations.length === 0 && <p>{empty}</p>}
      {iterations.map(iteration => <button className={active?.id === iteration.id ? "active" : ""} onClick={() => choose(iteration.id)} key={iteration.id}>
        <b>Iteration {iteration.sequence}</b>
        <span>{iteration.variant} · {iteration.model}</span>
        <span>{iteration.metrics.input_tokens + iteration.metrics.output_tokens} actual runtime tokens · {iteration.metrics.actual_latency_ms}ms</span>
        <i className={iteration.gate === "green" ? "pass" : "fail"}>{iteration.quality_score}% · {iteration.gate === "green" ? "passed" : "failed"}</i>
      </button>)}
    </aside>
    <section className="panel iteration-detail">
      {!active && <p>Select an iteration when it appears.</p>}
      {active && <IterationDetail iteration={active} />}
    </section>
  </section>
}

function IterationDetail({ iteration }: { iteration: Iteration }) {
  const tools = iteration.compile.optimized.steps.flatMap(step => step.tools ?? [])
  return <>
    <div className="detail-title">
      <div><small>Iteration {iteration.sequence}</small><h2>{iteration.variant}</h2></div>
      <div className="chips"><span className="pill">{iteration.model}</span><span className="pill">Akash sandbox</span><span className={`pill ${iteration.gate === "green" ? "ok" : "bad"}`}>{iteration.quality_score}%</span></div>
    </div>

    <div className="actual-metrics">
      <Metric label="Actual input tokens" value={`${iteration.metrics.input_tokens}`} />
      <Metric label="Actual output tokens" value={`${iteration.metrics.output_tokens}`} />
      <Metric label="Measured latency" value={`${iteration.metrics.actual_latency_ms}ms`} />
      <Metric label="Judge score" value={`${iteration.quality_score}%`} />
      <Metric label="Estimated runtime cost" value={money(iteration.metrics.cost_usd)} />
    </div>

    <section className="detail-section">
      <small>Generated prompt</small>
      <pre>{iteration.optimized_prompt}</pre>
    </section>

    <section className="detail-section">
      <small>Planned tools</small>
      {tools.length ? <div className="chips">{tools.map(tool => <span className="pill" key={tool.id}>{tool.name}</span>)}</div> : <p>No tools proposed for this variation.</p>}
    </section>

    <section className="detail-section">
      <small>Changes from your input</small>
      <div className="rows">{iteration.changes.length ? iteration.changes.map((change, index) => <div key={index}><b>{change.step ?? "workflow"}</b><span>{change.summary}</span></div>) : <p>Baseline: your workflow was used unchanged.</p>}</div>
    </section>

    <section className="detail-section">
      <small>Real AkashML judge · {iteration.evals.engine}</small>
      <div className="rows">{iteration.evals.cases.map(item => <div key={item.id}><b>{item.name} · {item.score}%</b><span>{item.reason}</span></div>)}</div>
    </section>

    <section className="detail-section">
      <small>Probe output</small>
      <pre>{iteration.probe_output}</pre>
    </section>

    <p className="measurement-note">Tokens are reported by the AkashML API. Latency is wall-clock measured. Cost is calculated from the configured AkashML token rates; it is not a billing receipt. Total experiment cost for this iteration: {money(iteration.metrics.experiment_cost_usd)}.</p>
  </>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>
}
