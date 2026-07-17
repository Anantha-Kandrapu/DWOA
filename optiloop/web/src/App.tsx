import { useEffect, useMemo, useState } from "react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  FormControlLabel,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material"
import BoltIcon from "@mui/icons-material/Bolt"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import RefreshIcon from "@mui/icons-material/Refresh"
import ShieldIcon from "@mui/icons-material/Shield"
import SwapHorizIcon from "@mui/icons-material/SwapHoriz"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"

const API = "http://localhost:8000"
const USE_MOCK = false

type CompileStep = { id: string; model: string; cost: number; downgraded?: boolean; provider?: string; tools?: Array<{ via: string }> }
type Compile = {
  baseline: { cost_usd: number; tokens: number; steps: CompileStep[] }
  optimized: { cost_usd: number; tokens: number; steps: CompileStep[] }
  savings_pct: number
  policy_blocks: Array<{ step: string; reason: string; kept_model: string }>
  compression: { tokens_saved: number; techniques: string[] }
}
type Eval = { id: string; status: "pass" | "fail"; ms: number }
type Event = { action?: string; event?: string; detail?: string; ts?: string; cost_before?: number; cost_after?: number; gate?: string }
type State = {
  running: boolean
  current_config: "baseline" | "optimized"
  last_event: Event | string | null
  compile: Compile
  evals: { passed: number; failed: number; total: number; cases: Eval[]; gate: "green" | "red"; engine: string }
  traces: Array<{ loop_id: string; observed_cost_usd: number; via?: string }>
  history: Event[]
}

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#8ab4f8" },
    secondary: { main: "#2dd4bf" },
    error: { main: "#f87171" },
    success: { main: "#4ade80" },
    background: { default: "#0b1020", paper: "#121a2b" },
    text: { primary: "#e8eefc", secondary: "#9aa8bd" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h3: { fontWeight: 700, letterSpacing: 0 },
    h5: { fontWeight: 700, letterSpacing: 0 },
    button: { fontWeight: 700, textTransform: "none" },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { border: "1px solid #24314a", backgroundImage: "none" } } },
    MuiButton: { styleOverrides: { root: { boxShadow: "none" } } },
  },
})

const mockCompile: Compile = {
  baseline: { cost_usd: 1.84, tokens: 11500, steps: [{ id: "plan", model: "gpt-4o", cost: 0.42 }, { id: "read", model: "gpt-4o", cost: 0.51 }, { id: "edit", model: "gpt-4o", cost: 0.63 }, { id: "verify", model: "gpt-4o", cost: 0.28 }] },
  optimized: { cost_usd: 0.22, tokens: 8280, steps: [{ id: "plan", model: "llama-3-8b-akash", cost: 0.03, downgraded: true, provider: "akash" }, { id: "read", model: "gpt-4o", cost: 0.12 }, { id: "edit", model: "llama-3-8b-akash", cost: 0.04, downgraded: true, provider: "akash", tools: [{ via: "zero.xyz" }] }, { id: "verify", model: "llama-3-8b-akash", cost: 0.03, downgraded: true, provider: "akash" }] },
  savings_pct: 88,
  policy_blocks: [{ step: "read", reason: "PII step cannot cascade to external/open model", kept_model: "gpt-4o" }],
  compression: { tokens_saved: 3220, techniques: ["system-prompt strip", "context dedupe"] },
}

const mockState = (): State => ({
  running: true, current_config: "optimized", last_event: { action: "shipped", ts: "now", cost_before: 1.84, cost_after: 0.22, gate: "green" }, compile: mockCompile,
  evals: { passed: 6, failed: 0, total: 6, cases: ["e1", "e2", "e3", "e4", "e5", "e6"].map((id, index) => ({ id, status: "pass", ms: 80 + index * 16 })), gate: "green", engine: "mock" },
  traces: [{ loop_id: "run-101", observed_cost_usd: 1.84 }, { loop_id: "run-102", observed_cost_usd: 1.91 }, { loop_id: "run-103", observed_cost_usd: 2.05 }],
  history: [{ action: "observed", detail: "Nexla trace received" }, { action: "compiled", detail: "Candidate optimized" }, { action: "shipped", detail: "All evals passed" }],
})

const money = (value: number) => `$${value.toFixed(value < 1 ? 3 : 2)}`

function App() {
  const [state, setState] = useState<State>(mockState)
  const [failureArmed, setFailureArmed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const mergeState = (next: Partial<State>) => setState(current => ({ ...current, ...next, compile: next.compile ?? current.compile, evals: next.evals ?? current.evals }))

  useEffect(() => {
    const refresh = async () => {
      if (USE_MOCK) return
      try { mergeState(await fetch(`${API}/state`).then(response => response.json())) } catch { setState(mockState()) }
    }
    refresh()
    const timer = window.setInterval(refresh, 1500)
    return () => window.clearInterval(timer)
  }, [])

  const compile = async () => {
    setRefreshing(true)
    try { if (!USE_MOCK) mergeState(await fetch(`${API}/force-compile`, { method: "POST" }).then(response => response.json())) }
    finally { window.setTimeout(() => setRefreshing(false), 350) }
  }

  const toggleFailure = async (checked: boolean) => {
    setFailureArmed(checked)
    if (!USE_MOCK) mergeState(await fetch(`${API}/inject-fail`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ case: checked ? "e3" : "" }) }).then(response => response.json()))
  }

  const baselineById = useMemo(() => Object.fromEntries(state.compile.baseline.steps.map(step => [step.id, step])), [state.compile])
  const costData = state.compile.optimized.steps.map(step => ({ name: step.id, before: baselineById[step.id]?.cost ?? 0, after: step.cost }))
  const blocked = state.evals.gate === "red"
  const latest = typeof state.last_event === "string" ? state.last_event : state.last_event?.action ?? state.last_event?.event ?? "ready"

  return <ThemeProvider theme={theme}>
    <CssBaseline />
    <AppBar color="inherit" elevation={0} position="sticky" sx={{ borderBottom: "1px solid #24314a", bgcolor: "rgba(18,26,43,.92)", backdropFilter: "blur(10px)" }}>
      <Toolbar sx={{ gap: 2 }}>
        <BoltIcon color="primary" />
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }}>OptiLoop</Typography>
        <Chip size="small" color={state.running ? "success" : "default"} label={state.running ? "Live" : "Paused"} />
        <Button startIcon={<PlayArrowIcon />} variant="contained" onClick={compile} disabled={refreshing}>Force compile</Button>
      </Toolbar>
    </AppBar>

    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Paper sx={{ p: { xs: 3, md: 4 }, overflow: "hidden" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: { md: "center" } }}>
            <Box sx={{ flex: 1 }}>
              <Chip size="small" color={blocked ? "error" : "primary"} icon={blocked ? <WarningAmberIcon /> : <CheckCircleIcon />} label={blocked ? "Reverted safely" : "Optimized config live"} />
              <Typography variant="h3" sx={{ mt: 2, mb: 1 }}>Material control room for cheaper agent loops.</Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 680 }}>OptiLoop watches traces, compiles a lower-cost route, honors policy, and only ships when the eval gate stays green.</Typography>
            </Box>
            <Stack spacing={2} sx={{ minWidth: { md: 290 } }}>
              <Metric label="Cost saved" value={`${state.compile.savings_pct}%`} />
              <Metric label="Current route" value={state.current_config} />
              <Metric label="Last event" value={latest} />
            </Stack>
          </Stack>
        </Paper>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.7fr .9fr" }, gap: 3 }}>
          <Paper sx={{ p: 3, minWidth: 0 }}>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Box>
                <Typography variant="overline" color="text.secondary">Cost per step</Typography>
                <Typography variant="h5">Before / after compilation</Typography>
              </Box>
              <Chip color={blocked ? "error" : "success"} label={blocked ? "Gate red" : "Gate green"} />
            </Stack>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costData} barGap={6}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={value => `$${value}`} />
                  <Tooltip cursor={{ fill: "#1b2942" }} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#e8eefc" }} formatter={value => typeof value === "number" ? money(value) : value ?? ""} />
                  <Bar dataKey="before" fill="#64748b" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="after" fill="#8ab4f8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Paper sx={{ p: 3, bgcolor: blocked ? "error.main" : "secondary.main", color: "#fff" }}>
            <Stack spacing={2} sx={{ height: "100%", justifyContent: "space-between" }}>
              <Box>
                {blocked ? <WarningAmberIcon fontSize="large" /> : <ShieldIcon fontSize="large" />}
                <Typography variant="h5" sx={{ mt: 1 }}>{blocked ? "Baseline restored" : "Safe to ship"}</Typography>
                <Typography sx={{ opacity: .88, mt: 1 }}>{blocked ? "An eval failed, so the controller kept the safer config." : "Every eval passed after optimization."}</Typography>
              </Box>
              <Box>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                  <Typography variant="h4">{money(state.compile.baseline.cost_usd)}</Typography>
                  <SwapHorizIcon />
                  <Typography variant="h4">{money(state.compile.optimized.cost_usd)}</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={Math.min(state.compile.savings_pct, 100)} sx={{ height: 8, borderRadius: 1, bgcolor: "rgba(255,255,255,.25)", "& .MuiLinearProgress-bar": { bgcolor: "#fff" } }} />
              </Box>
            </Stack>
          </Paper>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: ".9fr 1.1fr" }, gap: 3 }}>
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="overline" color="text.secondary">Eval gate</Typography>
                  <Typography variant="h5">{state.evals.passed}/{state.evals.total} passing</Typography>
                </Box>
                <FormControlLabel control={<Switch checked={failureArmed} onChange={event => toggleFailure(event.target.checked)} />} label="Fail e3" />
              </Stack>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {state.evals.cases.map(item => <Chip key={item.id} color={item.status === "pass" ? "success" : "error"} icon={item.status === "pass" ? <CheckCircleIcon /> : <WarningAmberIcon />} label={`${item.id} ${item.ms}ms`} />)}
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="overline" color="text.secondary">Compiler path</Typography>
            <Stack spacing={1.2} sx={{ mt: 1 }}>
              {state.compile.optimized.steps.map(step => <Stack key={step.id} direction="row" spacing={2} sx={{ alignItems: "center", p: 1.25, borderRadius: 1, bgcolor: "#172033" }}>
                <Chip size="small" label={step.id} color={step.downgraded ? "primary" : "default"} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{step.model}</Typography>
                  <Typography variant="body2" color="text.secondary">{step.provider ?? "OpenAI"} {step.tools?.[0]?.via ? `via ${step.tools[0].via}` : ""}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 800 }}>{money(step.cost)}</Typography>
              </Stack>)}
            </Stack>
          </Paper>
        </Box>

        <Paper sx={{ p: 3 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Box>
              <Typography variant="overline" color="text.secondary">Trace history</Typography>
              <Typography variant="h5">Controller timeline</Typography>
            </Box>
            <Button startIcon={<RefreshIcon />} onClick={compile} disabled={refreshing}>Run again</Button>
          </Stack>
          <Stack spacing={1}>
            {state.history.map((event, index) => <Stack key={`${event.action}-${index}`} direction="row" spacing={2} sx={{ p: 1.5, borderLeft: "4px solid #8ab4f8", bgcolor: "#172033" }}>
              <Typography sx={{ minWidth: 96, fontWeight: 800 }}>{event.action ?? event.event ?? "event"}</Typography>
              <Typography color="text.secondary">{event.detail ?? event.gate ?? "State updated"}</Typography>
            </Stack>)}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  </ThemeProvider>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Paper variant="outlined" sx={{ p: 2, bgcolor: "#172033" }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="h5" sx={{ mt: .5, textTransform: label === "Current route" ? "capitalize" : "none" }}>{value}</Typography>
  </Paper>
}

export default App
