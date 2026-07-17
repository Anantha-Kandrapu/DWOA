import { useEffect, useState } from "react"

const API = "http://localhost:8000"

type Tool = { id: string; name: string; side_effect?: boolean }
type Step = { id: string; model: string; cost: number; prompt?: string; prompt_tokens: number; tool_calls: number; tools?: Tool[]; provider?: string }
type Compile = {
  variant: string
  baseline: { cost_usd: number; tokens: number; tool_calls: number; estimated_latency_ms: number; steps: Step[] }
  optimized: { cost_usd: number; tokens: number; tool_calls: number; estimated_latency_ms: number; steps: Step[] }
  savings_pct: number
  prompt_optimization: { tokens_saved: number; changes: Change[] }
  tool_optimization: { calls_saved: number; changes: Change[] }
}
type Change = { type: string; step?: string; summary: string; removed?: string[] }
type Eval = { id: string; status: "pass" | "fail"; ms: number }
type Evals = { passed: number; failed: number; total: number; quality_score: number; cases: Eval[]; gate: "green" | "red" }
type Iteration = {
  id: string; batch_id: string; sequence: number; ts: string; variant: string; quality_score: number
  gate: "green" | "red"; decision: string; executor: string
  metrics: { prompt_tokens: number; tool_calls: number; estimated_latency_ms: number; cost_usd: number }
  changes: Change[]; compile: Compile; evals: Evals
}
type State = {
  running: boolean; current_config: string; compile: Compile; evals: Evals; iterations: Iteration[]
  integrations: Record<string, { configured: boolean; connected: boolean; error?: string }>
}

const money = (value: number) => `$${value.toFixed(value < 0.01 ? 5 : 3)}`
const phases = ["Observed", "Compiled", "Evaluated", "Decision"]

export default function App() {
  const [state, setState] = useState<State | null>(null)
  const [tab, setTab] = useState<"live" | "replay">("live")
  const [selectedId, setSelectedId] = useState("")
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)

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

  if (!state?.compile || !state.evals) return <main><section className="panel loading">Waiting for OptiLoop API…</section></main>

  return (
    <main>
      <header className="topbar">
        <strong>OptiLoop</strong>
        <span className="pill ok">{state.running ? "Live" : "Paused"}</span>
        {Object.entries(state.integrations ?? {}).map(([name, value]) => <span className={`pill ${value.connected ? "ok" : ""}`} title={value.error} key={name}>{name} {value.connected ? "connected" : value.configured ? "checking" : "off"}</span>)}
        <button onClick={() => post("/force-compile")} disabled={busy}>Run variants</button>
      </header>

      <section className="hero">
        <div>
          <span className={`pill ${state.evals.gate === "green" ? "ok" : "bad"}`}>{state.evals.gate === "green" ? "Verified optimization live" : "Baseline protected"}</span>
          <h1>Prompt and tool optimization, iteration by iteration.</h1>
          <p>Four variants run in parallel. Every score, prompt change, tool merge, and ship decision stays inspectable and replayable.</p>
        </div>
        <div className="metrics">
          <Metric label="Quality score" value={`${state.evals.quality_score}%`} />
          <Metric label="Winning variant" value={state.compile.variant} />
          <Metric label="Iterations" value={`${iterations.length}`} />
        </div>
      </section>

      <nav className="tabs">
        <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>Live</button>
        <button className={tab === "replay" ? "active" : ""} onClick={() => setTab("replay")}>Replay</button>
      </nav>

      {tab === "live" ? <Live state={state} selected={selected} select={setSelectedId} post={post} /> : <Replay iterations={iterations} selected={selected} select={id => { setSelectedId(id); setPhase(0); setPlaying(false) }} phase={phase} setPhase={setPhase} playing={playing} setPlaying={setPlaying} />}
    </main>
  )
}

function Live({ state, selected, select, post }: { state: State; selected?: Iteration; select: (id: string) => void; post: (path: string, body?: unknown) => void }) {
  const before = state.compile.baseline
  const after = state.compile.optimized
  return <>
    <section className="panel graph-panel">
      <div className="panel-head"><div><small>Live quality score</small><h2>Parallel optimization timeline</h2></div><span className="pill">one dot per variant</span></div>
      <ScoreGraph iterations={state.iterations} selectedId={selected?.id} select={select} />
    </section>

    <section className="metric-grid">
      <Compare label="Prompt tokens" before={before.tokens} after={after.tokens} />
      <Compare label="Tool calls" before={before.tool_calls} after={after.tool_calls} />
      <Compare label="Latency" before={before.estimated_latency_ms} after={after.estimated_latency_ms} suffix="ms" />
      <Compare label="Cost" before={money(before.cost_usd)} after={money(after.cost_usd)} />
    </section>

    {selected && <IterationDetails iteration={selected} />}

    <section className="panel eval-panel">
      <div className="panel-head"><div><small>Eval gate</small><h2>{state.evals.passed}/{state.evals.total} passing</h2></div><label className="toggle"><input type="checkbox" onChange={event => post("/inject-fail", { case: event.target.checked ? "e3" : "" })} /> Inject regression</label></div>
      <div className="chips">{state.evals.cases.map(item => <span className={`pill ${item.status === "pass" ? "ok" : "bad"}`} key={item.id}>{item.id} · {item.ms}ms</span>)}</div>
    </section>
  </>
}

function ScoreGraph({ iterations, selectedId, select }: { iterations: Iteration[]; selectedId?: string; select: (id: string) => void }) {
  const batchIds = [...new Set(iterations.map(item => item.batch_id))].slice(-10)
  const points = iterations.filter(item => batchIds.includes(item.batch_id))
  const variants = [...new Set(points.map(item => item.variant))]
  const width = 1000, height = 230, pad = 28
  const coords = points.map(item => ({ item, x: pad + batchIds.indexOf(item.batch_id) * ((width - pad * 2) / Math.max(1, batchIds.length - 1)), y: pad + (100 - Math.max(0, Math.min(100, item.quality_score))) * ((height - pad * 2) / 100) }))
  return <div className="graph"><div className="graph-legend">{variants.map(variant => <span className={`variant-${variant}`} key={variant}><i />{variant}</span>)}</div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Quality scores for parallel variants by batch">
    {[0, 25, 50, 75, 100].map(score => <g key={score}><line x1={pad} x2={width - pad} y1={pad + (100 - score) * ((height - pad * 2) / 100)} y2={pad + (100 - score) * ((height - pad * 2) / 100)} /><text x="0" y={pad + 4 + (100 - score) * ((height - pad * 2) / 100)}>{score}</text></g>)}
    {variants.map(variant => <polyline className={`variant-${variant}`} key={variant} points={coords.filter(point => point.item.variant === variant).map(point => `${point.x},${point.y}`).join(" ")} />)}
    {coords.map(({ item, x, y }) => <g key={item.id} role="button" tabIndex={0} aria-label={`${item.variant}, score ${item.quality_score}%, ${item.gate}`} className={`score-point variant-${item.variant} ${item.gate === "red" ? "failed" : ""} ${selectedId === item.id ? "selected" : ""}`} onClick={() => select(item.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(item.id) } }}><circle cx={x} cy={y} r={selectedId === item.id ? 8 : 6}><title>{`${item.variant}: ${item.quality_score}% · ${item.changes.map(change => change.summary).join("; ") || "no changes"}`}</title></circle></g>)}
  </svg></div>
}

function IterationDetails({ iteration }: { iteration: Iteration }) {
  const tools = iteration.compile.optimized.steps.flatMap(step => (step.tools ?? []).map(tool => ({ ...tool, step: step.id })))
  return <section className="grid">
    <section className="panel"><small>Selected iteration</small><h2>#{iteration.sequence} · {iteration.variant}</h2><div className="iteration-meta"><span className={`pill ${iteration.gate === "green" ? "ok" : "bad"}`}>{iteration.quality_score}%</span><span className="pill">{iteration.executor}</span><span className="pill">{iteration.decision}</span></div><div className="change-list">{iteration.changes.length ? iteration.changes.map((change, index) => <div key={`${change.type}-${index}`}><strong>{change.step ?? "loop"}</strong><span>{change.summary}</span></div>) : <p>No prompt or tool changes.</p>}</div></section>
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
  if (phase === 1) return <div className="metric-grid replay-metrics"><Compare label="Prompt tokens" before={before.tokens} after={after.tokens} /><Compare label="Tool calls" before={before.tool_calls} after={after.tool_calls} /><Compare label="Latency" before={before.estimated_latency_ms} after={after.estimated_latency_ms} suffix="ms" /><Compare label="Cost" before={money(before.cost_usd)} after={money(after.cost_usd)} /></div>
  if (phase === 2) return <div className="replay-card"><h2>{iteration.evals.passed}/{iteration.evals.total} evals passed</h2><div className="chips">{iteration.evals.cases.map(item => <span className={`pill ${item.status === "pass" ? "ok" : "bad"}`} key={item.id}>{item.id} · {item.ms}ms</span>)}</div></div>
  return <IterationDetails iteration={iteration} />
}

function Compare({ label, before, after, suffix = "" }: { label: string; before: number | string; after: number | string; suffix?: string }) {
  return <div className="panel compare"><small>{label}</small><strong>{before}{suffix} <i>→</i> {after}{suffix}</strong></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><small>{label}</small><strong>{value}</strong></div>
}
