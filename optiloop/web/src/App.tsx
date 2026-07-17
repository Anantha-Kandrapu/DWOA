import { useEffect, useState } from "react"

const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8001"

type Tool = { id: string; name: string; side_effect?: boolean }
type Step = { id: string; model: string; cost: number; prompt?: string; prompt_tokens: number; tool_calls: number; tools?: Tool[]; provider?: string }
type Compile = {
  variant: string
  baseline: { cost_usd: number; tokens: number; output_tokens: number; expected_turns: number; clarification_turns: number; tool_calls: number; estimated_latency_ms: number; steps: Step[] }
  optimized: { cost_usd: number; tokens: number; output_tokens: number; expected_turns: number; clarification_turns: number; tool_calls: number; estimated_latency_ms: number; steps: Step[] }
  savings_pct: number
  prompt_optimization: { tokens_saved: number; turns_saved: number; context_added: number; changes: Change[] }
  tool_optimization: { calls_saved: number; changes: Change[] }
}
type Change = { type: string; step?: string; summary: string; removed?: string[] }
type Eval = { id: string; name: string; status: "pass" | "fail"; ms: number }
type Evals = { passed: number; failed: number; total: number; quality_score: number; cases: Eval[]; gate: "green" | "red" }
type Iteration = {
  id: string; batch_id: string; sequence: number; ts: string; variant: string; quality_score: number
  gate: "green" | "red"; decision: string; executor: string
  metrics: { prompt_tokens: number; input_tokens: number; output_tokens: number; expected_turns: number; tool_calls: number; estimated_latency_ms: number; cost_usd: number }
  changes: Change[]; compile: Compile; evals: Evals
}
type LiveEvent = { sequence: number; ts: string; phase: string; batch_id: string; variant: string; executor: string; details: Record<string, string | number> }
type SessionSummary = { id: string; workflow_id: string; started_at: string; completed_at: string; status: string; winner_id: string; iteration_count: number }
type Session = SessionSummary & { baseline: Compile["baseline"]; final: Compile["optimized"]; iterations: Iteration[]; events: LiveEvent[]; winner: Iteration }
type State = {
  running: boolean; current_config: string; compile: Compile; evals: Evals; iterations: Iteration[]
  live_events: LiveEvent[]; sessions: SessionSummary[]
  integrations: Record<string, { configured: boolean; connected: boolean; error?: string }>
}

const money = (value: number) => `$${value.toFixed(value < 0.01 ? 5 : 3)}`
const phases = ["Observed", "Compiled", "Evaluated", "Decision"]
const demoWorkflow = "Refund order ORD-1042 for customer CUST-88 when the order is damaged or late. Verify policy, prevent duplicate refunds, and notify the customer."

export default function App() {
  const [state, setState] = useState<State | null>(null)
  const [tab, setTab] = useState<"live" | "replay" | "history">("live")
  const [selectedId, setSelectedId] = useState("")
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [workflow, setWorkflow] = useState(demoWorkflow)

  const refresh = async () => {
    const next = await fetch(`${API}/state`).then(response => response.json())
    setState(next)
    setSelectedId(current => current || next.iterations?.[next.iterations.length - 1]?.id || "")
  }

  useEffect(() => {
    refresh().catch(() => undefined)
    const timer = window.setInterval(() => refresh().catch(() => undefined), 1500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setPhase(current => current >= phases.length - 1 ? (setPlaying(false), current) : current + 1), 700)
    return () => window.clearInterval(timer)
  }, [playing])

  const post = async (path: string, body?: unknown) => {
    setBusy(true)
    try {
      const next = await fetch(`${API}${path}`, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }).then(response => response.json())
      setState(next)
      setSelectedId(next.iterations?.[next.iterations.length - 1]?.id || "")
    } finally {
      setBusy(false)
    }
  }

  const iterations = state?.iterations ?? []
  const selected = iterations.find(item => item.id === selectedId) ?? iterations[iterations.length - 1]
  const run = () => post("/run-iterations", { count: 20, workflow })

  if (!state?.compile || !state.evals) return <main><header className="topbar"><strong className="brand">DWOA <span>Dynamic Workflow Optimization Agent</span></strong></header><WorkflowInput value={workflow} setValue={setWorkflow} run={run} busy={busy} /></main>

  return (
    <main>
      <header className="topbar">
        <strong className="brand">DWOA <span>Dynamic Workflow Optimization Agent</span></strong>
        <span className="pill ok">{state.running ? "Ready" : "Paused"}</span>
      </header>

      <WorkflowInput value={workflow} setValue={setWorkflow} run={run} busy={busy} />

      <nav className="tabs">
        <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>Results</button>
        <button className={tab === "replay" ? "active" : ""} onClick={() => setTab("replay")}>Inspect iterations</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Previous runs</button>
      </nav>

      {tab === "live" && <Live state={state} selected={selected} select={setSelectedId} post={post} />}
      {tab === "replay" && <Replay iterations={iterations} selected={selected} select={id => { setSelectedId(id); setPhase(0); setPlaying(false) }} phase={phase} setPhase={setPhase} playing={playing} setPlaying={setPlaying} />}
      {tab === "history" && <History sessions={state.sessions ?? []} />}
    </main>
  )
}

function Live({ state, selected, select, post }: { state: State; selected?: Iteration; select: (id: string) => void; post: (path: string, body?: unknown) => void }) {
  const first = state.iterations[0]
  const best = state.iterations.filter(item => item.gate === "green").reduce((winner, item) => item.metrics.cost_usd < winner.metrics.cost_usd ? item : winner, state.iterations[0])
  const reduction = Math.max(0, Math.round((1 - best.metrics.cost_usd / first.metrics.cost_usd) * 100))
  return <>
    <section className="outcome">
      <small>Optimization complete</small>
      <h1>{reduction}% lower estimated cost</h1>
      <p>DWOA tested 20 versions and selected iteration #{best.sequence}. All {best.evals.total} safety and quality checks passed.</p>
    </section>

    <section className="before-after">
      <ResultCard title="Original workflow" iteration={first} />
      <strong className="result-arrow">→</strong>
      <ResultCard title="Optimized workflow" iteration={best} winner />
    </section>

    <section className="panel graph-panel">
      <div className="panel-head"><div><small>Progress</small><h2>Estimated cost across 20 attempts</h2></div><span className="pill">lower is better</span></div>
      <CostGraph iterations={state.iterations} selectedId={selected?.id} select={select} />
    </section>

    <section className="grid result-explanation">
      <section className="panel"><small>What DWOA changed</small><h2>Prompt and tool improvements</h2><div className="change-list">{best.changes.map((change, index) => <div key={`${change.type}-${index}`}><strong>{change.step ?? "workflow"}</strong><span>{change.summary}</span></div>)}</div></section>
      <section className="panel"><small>Verification</small><h2>{best.evals.passed}/{best.evals.total} checks passed</h2><p>The optimized version kept refund rules, duplicate-refund protection, and customer notification behavior intact.</p><div className="chips">{best.evals.cases.map(item => <span className="pill ok" key={item.id}>{item.name}</span>)}</div></section>
    </section>

    <details className="panel technical"><summary>Show technical telemetry</summary><div className="panel-head"><div><small>Akash sandbox + Nexla</small><h2>{state.live_events?.length ?? 0} recorded events</h2></div><label className="toggle"><input type="checkbox" onChange={event => post("/inject-fail", { case: event.target.checked ? "e3" : "" })} /> Simulate a failed check</label></div><div className="event-stream">{[...(state.live_events ?? [])].reverse().slice(0, 40).map((event, index) => <div key={`${event.batch_id}-${event.variant}-${event.sequence}-${index}`}><span className="event-time">{new Date(event.ts).toLocaleTimeString()}</span><strong>{event.variant}</strong><span className="pill">{event.phase.split("_").join(" ")}</span><span>{Object.entries(event.details ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ")}</span></div>)}</div></details>
  </>
}

function ResultCard({ title, iteration, winner = false }: { title: string; iteration: Iteration; winner?: boolean }) {
  return <section className={`panel result-card ${winner ? "winner" : ""}`}><small>{title}</small><strong className="result-cost">{money(iteration.metrics.cost_usd)}</strong><span>estimated cost per run</span><dl><div><dt>Input tokens</dt><dd>{iteration.metrics.input_tokens}</dd></div><div><dt>Output tokens</dt><dd>{iteration.metrics.output_tokens}</dd></div><div><dt>Expected turns</dt><dd>{iteration.metrics.expected_turns}</dd></div><div><dt>Tool calls</dt><dd>{iteration.metrics.tool_calls}</dd></div><div><dt>Quality</dt><dd>{iteration.quality_score}%</dd></div></dl>{winner && <span className="pill ok">Selected · iteration #{iteration.sequence}</span>}</section>
}

function History({ sessions }: { sessions: SessionSummary[] }) {
  const [selected, setSelected] = useState<Session | null>(null)
  const open = async (id: string) => setSelected(await fetch(`${API}/sessions/${id}`).then(response => response.json()))
  return <section className="replay-grid">
    <aside className="panel replay-list"><small>Workflow sessions</small>{sessions.map(session => <button className={selected?.id === session.id ? "active" : ""} key={session.id} onClick={() => open(session.id)}> {session.workflow_id}<span>{session.iteration_count} iterations · {session.status}</span><span>{new Date(session.completed_at).toLocaleString()}</span></button>)}</aside>
    <section className="panel replay-stage">{selected ? <><div className="panel-head"><div><small>Completed optimization session</small><h2>{selected.workflow_id}</h2></div><span className={`pill ${selected.status === "completed" ? "ok" : "bad"}`}>{selected.status}</span></div><section className="metric-grid replay-metrics"><Compare label="Input tokens" before={selected.baseline.tokens} after={selected.final.tokens} /><Compare label="Expected turns" before={selected.baseline.expected_turns} after={selected.final.expected_turns} /><Compare label="Tool calls" before={selected.baseline.tool_calls} after={selected.final.tool_calls} /><Compare label="Latency" before={selected.baseline.estimated_latency_ms} after={selected.final.estimated_latency_ms} suffix="ms" /><Compare label="Cost" before={money(selected.baseline.cost_usd)} after={money(selected.final.cost_usd)} /></section><h2 className="history-heading">All candidate iterations</h2>{selected.iterations.map(iteration => <IterationDetails iteration={iteration} key={iteration.id} />)}<h2 className="history-heading">Complete event trail</h2><div className="event-stream">{selected.events.map((event, index) => <div key={`${event.variant}-${event.sequence}-${index}`}><span className="event-time">{new Date(event.ts).toLocaleTimeString()}</span><strong>{event.variant}</strong><span className="pill">{event.phase.split("_").join(" ")}</span><span>{Object.entries(event.details ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ")}</span></div>)}</div></> : <p>Select a completed workflow session to inspect every iteration, event, eval, and final decision.</p>}</section>
  </section>
}

function CostGraph({ iterations, selectedId, select }: { iterations: Iteration[]; selectedId?: string; select: (id: string) => void }) {
  const width = 1000, height = 230, pad = 28
  const costs = iterations.map(item => item.metrics.cost_usd)
  const min = Math.min(...costs), max = Math.max(...costs), range = max - min || 1
  const coords = iterations.map((item, index) => ({ item, x: pad + index * ((width - pad * 2) / Math.max(1, iterations.length - 1)), y: pad + (item.metrics.cost_usd - min) / range * (height - pad * 2) }))
  let best = Infinity
  const bestPoints = coords.map(point => ({ ...point, y: pad + ((best = Math.min(best, point.item.metrics.cost_usd)) - min) / range * (height - pad * 2) }))
  return <div className="graph"><div className="graph-legend"><span><i />candidate cost</span><span className="best-line"><i />best so far</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Estimated cost by iteration">
    <line x1={pad} x2={width - pad} y1={pad} y2={pad} /><text x="0" y={pad + 4}>{money(min)}</text>
    <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} /><text x="0" y={height - pad + 4}>{money(max)}</text>
    <polyline className="candidate-line" points={coords.map(point => `${point.x},${point.y}`).join(" ")} />
    <polyline className="best-line" points={bestPoints.map(point => `${point.x},${point.y}`).join(" ")} />
    {coords.map(({ item, x, y }) => <g key={item.id} role="button" tabIndex={0} aria-label={`Iteration ${item.sequence}, ${money(item.metrics.cost_usd)}, ${item.variant}`} className={`cost-point ${selectedId === item.id ? "selected" : ""}`} onClick={() => select(item.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(item.id) } }}><circle cx={x} cy={y} r={selectedId === item.id ? 8 : 6}><title>{`#${item.sequence} ${item.variant}: ${money(item.metrics.cost_usd)} · ${item.changes.map(change => change.summary).join("; ") || "no changes"}`}</title></circle></g>)}
  </svg></div>
}

function WorkflowInput({ value, setValue, run, busy }: { value: string; setValue: (value: string) => void; run: () => void; busy: boolean }) {
  return <section className="panel workflow-input"><div><small>1 · Describe the workflow</small><h1>What should DWOA optimize?</h1><p>Use the refund example below, then watch cost, tokens, turns, and tool calls change across 20 Akash iterations.</p></div><textarea aria-label="Workflow to optimize" value={value} onChange={event => setValue(event.target.value)} /><button onClick={run} disabled={busy || !value.trim()}>{busy ? "Running 20 iterations on Akash…" : "Optimize workflow"}</button></section>
}

function IterationDetails({ iteration }: { iteration: Iteration }) {
  const tools = iteration.compile.optimized.steps.flatMap(step => (step.tools ?? []).map(tool => ({ ...tool, step: step.id })))
  const models = [...new Set(iteration.compile.optimized.steps.map(step => `${step.model} · ${step.provider}`))]
  return <section className="grid">
    <section className="panel"><small>Selected iteration</small><h2>#{iteration.sequence} · {iteration.variant}</h2><div className="iteration-meta"><span className={`pill ${iteration.gate === "green" ? "ok" : "bad"}`}>{iteration.quality_score}%</span><span className="pill">{iteration.executor}</span><span className="pill">{iteration.decision}</span></div><div className="chips">{models.map(model => <span className="pill" key={model}>{model}</span>)}</div><div className="change-list">{iteration.changes.length ? iteration.changes.map((change, index) => <div key={`${change.type}-${index}`}><strong>{change.step ?? "loop"}</strong><span>{change.summary}</span></div>) : <p>No prompt or tool changes.</p>}</div></section>
    <section className="panel"><small>Protected tool plan</small><h2>Side effects stay intact</h2><div className="change-list">{tools.length ? tools.map(tool => <div key={`${tool.step}-${tool.id}`}><strong>{tool.name}</strong><span>{tool.step} · {tool.side_effect ? "protected side effect" : "read-only"}</span></div>) : <p>No tools in this iteration.</p>}</div></section>
  </section>
}

function Replay({ iterations, selected, select, phase, setPhase, playing, setPlaying }: { iterations: Iteration[]; selected?: Iteration; select: (id: string) => void; phase: number; setPhase: (value: number) => void; playing: boolean; setPlaying: (value: boolean) => void }) {
  return <section className="replay-grid">
    <aside className="panel replay-list"><small>Recorded snapshots</small>{[...iterations].reverse().map(item => <button className={selected?.id === item.id ? "active" : ""} key={item.id} onClick={() => select(item.id)}>#{item.sequence} {item.variant}<span>{item.quality_score}% · {item.gate}</span></button>)}</aside>
    <section className="panel replay-stage">{selected ? <><div className="panel-head"><div><small>Replay without side effects</small><h2>{phases[phase]}</h2></div><span className={`pill ${selected.gate === "green" ? "ok" : "bad"}`}>{selected.decision}</span></div><div className="phase-track">{phases.map((name, index) => <button className={index <= phase ? "done" : ""} aria-current={index === phase ? "step" : undefined} onClick={() => { setPhase(index); setPlaying(false) }} key={name}><b>{index + 1}</b><span>{name}</span></button>)}</div><ReplayPhase iteration={selected} phase={phase} /><div className="replay-controls"><button onClick={() => { setPhase(Math.max(0, phase - 1)); setPlaying(false) }} disabled={phase === 0}>Previous</button><button onClick={() => { if (phase === phases.length - 1) setPhase(0); setPlaying(!playing) }}>{playing ? "Pause" : phase === phases.length - 1 ? "Play again" : "Play"}</button><button onClick={() => { setPhase(Math.min(phases.length - 1, phase + 1)); setPlaying(false) }} disabled={phase === phases.length - 1}>Next</button><button onClick={() => { setPhase(0); setPlaying(false) }}>Restart</button></div></> : <p>No recorded iterations yet.</p>}</section>
  </section>
}

function ReplayPhase({ iteration, phase }: { iteration: Iteration; phase: number }) {
  const before = iteration.compile.baseline, after = iteration.compile.optimized
  if (phase === 0) return <div className="replay-card"><small>Snapshot</small><h2>#{iteration.sequence} · {iteration.variant}</h2><p>{new Date(iteration.ts).toLocaleString()} · batch {iteration.batch_id}</p></div>
  if (phase === 1) return <div className="metric-grid replay-metrics"><Compare label="Input tokens" before={before.tokens} after={after.tokens} /><Compare label="Expected turns" before={before.expected_turns} after={after.expected_turns} /><Compare label="Tool calls" before={before.tool_calls} after={after.tool_calls} /><Compare label="Latency" before={before.estimated_latency_ms} after={after.estimated_latency_ms} suffix="ms" /><Compare label="Cost" before={money(before.cost_usd)} after={money(after.cost_usd)} /></div>
  if (phase === 2) return <div className="replay-card"><h2>{iteration.evals.passed}/{iteration.evals.total} evals passed</h2><div className="chips">{iteration.evals.cases.map(item => <span className={`pill ${item.status === "pass" ? "ok" : "bad"}`} key={item.id}>{item.name} · {item.ms}ms</span>)}</div></div>
  return <IterationDetails iteration={iteration} />
}

function Compare({ label, before, after, suffix = "" }: { label: string; before: number | string; after: number | string; suffix?: string }) {
  return <div className="panel compare"><small>{label}</small><strong>{before}{suffix} <i>→</i> {after}{suffix}</strong></div>
}
