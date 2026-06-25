import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Square, Send, ArrowLeft, Activity, Zap, Database, Copy, Check, RefreshCw, Trash2, RotateCcw, ChevronDown, Webhook } from 'lucide-react'
import { API_BASE } from '../lib/api'
import { Container } from '../components/ui'
import { useT } from '../lib/i18n'

const TARGETS = [
  { key: 'demo-key-123', label: 'Демо (с данными)', login: 'demo / demo12345' },
  { key: 'test-key-1', label: 'Тест 1 (пустой)', login: 'test1 / test12345' },
  { key: 'test-key-2', label: 'Тест 2 (пустой)', login: 'test2 / test12345' },
  { key: 'test-key-3', label: 'Тест 3 (пустой)', login: 'test3 / test12345' },
]
const TICK_MS = 600

const TYPES = [
  { key: 'access', label: 'Вход', labelKey: 'testenv.type.access', path: '/v1/events/access', color: '#0ea5e9' },
  { key: 'transaction', label: 'Транзакция', labelKey: 'testenv.type.transaction', path: '/v1/events/transaction', color: '#059669' },
  { key: 'data', label: 'Данные', labelKey: 'testenv.type.data', path: '/v1/events/data', color: '#8b5cf6' },
  { key: 'email', label: 'Почта', labelKey: 'testenv.type.email', path: '/v1/events/email', color: '#f59e0b' },
] as const

type TKey = (typeof TYPES)[number]['key']

const SEV_COLOR = ['#9ca3af', '#9ca3af', '#facc15', '#fb923c', '#f87171', '#ef4444']

const PRESETS: { name: string; nameKey: string; malicious: number; rate: number; weights: Record<TKey, number> }[] = [
  { name: 'Спокойно', nameKey: 'testenv.preset.calm', malicious: 5, rate: 4, weights: { access: 50, transaction: 30, data: 20, email: 20 } },
  { name: 'Подозрительно', nameKey: 'testenv.preset.suspicious', malicious: 30, rate: 8, weights: { access: 40, transaction: 40, data: 30, email: 30 } },
  { name: 'Атака', nameKey: 'testenv.preset.attack', malicious: 70, rate: 12, weights: { access: 35, transaction: 50, data: 45, email: 30 } },
  { name: 'Шторм', nameKey: 'testenv.preset.storm', malicious: 50, rate: 26, weights: { access: 50, transaction: 50, data: 40, email: 40 } },
]

const ATTACK_VOLUMES = [
  { rows: 100000, label: '100 000' },
  { rows: 500000, label: '500 000' },
  { rows: 1000000, label: '1 000 000' },
]

const rid = () => Math.random().toString(36).slice(2, 8)
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

function payloadFor(type: TKey, bad: boolean): any {
  const ts = new Date().toISOString()
  if (type === 'access')
    return bad
      ? { ts, user: `u.${rid()}`, ip: '175.223.10.4', country: pick(['RU', 'KR', 'CN', 'NL']), success: true }
      : { ts, user: `u.${rid()}`, ip: `10.0.0.${Math.floor(Math.random() * 255)}`, country: 'KZ', success: true }
  if (type === 'transaction')
    return bad
      ? { ts, from: `C${rid()}`, to: `C${rid()}`, amount: 100000 + Math.floor(Math.random() * 800000), type: 'cash_out' }
      : { ts, from: `C${rid()}`, to: `C${rid()}`, amount: Math.floor(Math.random() * 5000), type: 'payment' }
  if (type === 'data')
    return bad
      ? { ts, user: `u.${rid()}`, resource: 'db.clients', action: 'export', rows: 4000 + Math.floor(Math.random() * 16000), content: 'ИИН 901224300945, карта 4400 4302 3209 8821' }
      : { ts, user: `u.${rid()}`, resource: 'wiki', action: 'access', rows: Math.floor(Math.random() * 60) }
  return bad
    ? { ts, from: 'no-reply@kaspi-bonus.xn--80a.tk', to: 'user@bank.kz', subject: 'Ваш бонус активирован', links: ['http://kaspi-bonus.xn--80a.tk/login'] }
    : { ts, from: 'team@retker.kz', to: 'user@bank.kz', subject: 'Еженедельный отчёт', links: ['https://retker.kz/report'] }
}

const fmt = (n: number) => (typeof n === 'number' ? n.toLocaleString('ru-RU') : n)

export function TestEnv() {
  const TR = useT()
  const [enabled, setEnabled] = useState<Record<TKey, boolean>>({ access: true, transaction: true, data: true, email: true })
  const [weights, setWeights] = useState<Record<TKey, number>>({ access: 50, transaction: 30, data: 15, email: 25 })
  const [malicious, setMalicious] = useState(25)
  const [rate, setRate] = useState(6)
  const [running, setRunning] = useState(false)
  const [target, setTarget] = useState('test-key-1')

  const [stats, setStats] = useState({ sent: 0, alerts: 0, incidents: 0 })
  const [byType, setByType] = useState<Record<string, number>>({})
  const [byDet, setByDet] = useState<Record<string, number>>({})
  const [series, setSeries] = useState<{ sent: number; alerts: number }[]>([])
  const [feed, setFeed] = useState<any[]>([])
  const incidentIds = useRef<Set<string>>(new Set())
  const cfg = useRef({ enabled, weights, malicious, rate, target })
  cfg.current = { enabled, weights, malicious, rate, target }

  async function fire(type: TKey, bad: boolean) {
    try {
      const res = await fetch(`${API_BASE}${TYPES.find((t) => t.key === type)!.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Org-Key': cfg.current.target },
        body: JSON.stringify(payloadFor(type, bad)),
      })
      if (!res.ok) return null
      return { type, j: await res.json() }
    } catch {
      return null
    }
  }

  async function tick(once = false) {
    const { enabled, weights, malicious, rate } = cfg.current
    const active = TYPES.filter((t) => enabled[t.key])
    if (!active.length) return
    const perTick = once ? 1 : Math.max(1, Math.round((rate * TICK_MS) / 1000))
    const totalW = active.reduce((s, t) => s + (weights[t.key] || 1), 0) || active.length
    const batch: { type: TKey; bad: boolean }[] = []
    for (let i = 0; i < perTick; i++) {
      let r = Math.random() * totalW
      let chosen = active[0]
      for (const t of active) {
        r -= weights[t.key] || 1
        if (r <= 0) { chosen = t; break }
      }
      batch.push({ type: chosen.key, bad: Math.random() * 100 < malicious })
    }
    const res = (await Promise.all(batch.map((b) => fire(b.type, b.bad)))).filter(Boolean) as any[]

    let alerts = 0
    const dTypes: Record<string, number> = {}
    const dDet: Record<string, number> = {}
    const newFeed: any[] = []
    for (const r of res) {
      dTypes[r.type] = (dTypes[r.type] || 0) + 1
      alerts += (r.j.alerts || []).length
      for (const det of r.j.risk?.detectors || []) dDet[det] = (dDet[det] || 0) + 1
      if (r.j.incident_id) incidentIds.current.add(r.j.incident_id)
      newFeed.push({ type: r.type, sev: r.j.risk?.severity || 1, score: r.j.risk?.score || 0, dets: r.j.risk?.detectors || [], id: r.j.event_id })
    }
    setStats((s) => ({ sent: s.sent + res.length, alerts: s.alerts + alerts, incidents: incidentIds.current.size }))
    setByType((m) => { const n = { ...m }; for (const k in dTypes) n[k] = (n[k] || 0) + dTypes[k]; return n })
    setByDet((m) => { const n = { ...m }; for (const k in dDet) n[k] = (n[k] || 0) + dDet[k]; return n })
    setSeries((s) => [...s.slice(-39), { sent: res.length, alerts }])
    setFeed((f) => [...newFeed.reverse(), ...f].slice(0, 14))
  }

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => tick(), TICK_MS)
    return () => window.clearInterval(id)
  }, [running])

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setEnabled({ access: true, transaction: true, data: true, email: true })
    setWeights(p.weights); setMalicious(p.malicious); setRate(p.rate)
  }

  const reset = () => {
    setRunning(false)
    setStats({ sent: 0, alerts: 0, incidents: 0 })
    setByType({}); setByDet({}); setSeries([]); setFeed([])
    incidentIds.current = new Set()
  }

  const anyEnabled = TYPES.some((t) => enabled[t.key])
  const alertRate = stats.sent ? Math.round((stats.alerts / stats.sent) * 100) : 0

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <Container className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/app" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
              <ArrowLeft size={18} />
            </Link>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">retker</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">{TR('testenv.header.badge')}</span>
          </div>
          <span className={`flex items-center gap-1.5 text-[11px] ${running ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
            {running ? TR('testenv.status.running') : TR('testenv.status.stopped')}
          </span>
        </Container>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <Container className="py-10 sm:py-14">
          <p className="text-sm font-medium tracking-tight text-emerald-600">{TR('testenv.hero.eyebrow')}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{TR('testenv.hero.title')}</h1>
          <p className="mt-4 max-w-2xl text-slate-500">
            {TR('testenv.hero.desc')}
          </p>
        </Container>
      </section>

      <Container className="space-y-5 py-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <DatasetAttack />
          <WebhookConsole />
        </div>

        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          {/* ── управление ── */}
          <div className="space-y-4">
            <Card>
              <div className="text-sm font-semibold text-slate-900">Куда идёт поток</div>
              <p className="mt-1 text-xs text-slate-500">Орг-приёмник (по её X-Org-Key). Залогинься этими кредами, чтобы видеть поток в дашборде.</p>
              <div className="mt-3 space-y-1.5">
                {TARGETS.map((tg) => (
                  <button key={tg.key} onClick={() => setTarget(tg.key)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors ${target === tg.key ? 'border-emerald-300 bg-emerald-50 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                    <span>{tg.label}</span>
                    <span className="font-mono text-[11px] text-slate-400">{tg.login}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 font-mono text-[11px] text-slate-400">X-Org-Key: {target}</p>
            </Card>

            <Card>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                <Zap size={15} /> {TR('testenv.presets.title')}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p.name} onClick={() => applyPreset(p)}
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200">
                    {TR(p.nameKey)}
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <div className="text-sm font-semibold text-slate-900">{TR('testenv.doors.title')}</div>
              <div className="mt-3 space-y-2.5">
                {TYPES.map((t) => {
                  const on = enabled[t.key]
                  return (
                    <div key={t.key} className={`rounded-xl border px-3 py-2.5 transition-colors ${on ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-white'}`}>
                      <button onClick={() => setEnabled((s) => ({ ...s, [t.key]: !s[t.key] }))}
                        className="flex w-full items-center justify-between text-sm">
                        <span className={`flex items-center gap-2 ${on ? 'text-slate-900' : 'text-slate-400'}`}>
                          <span className="h-2.5 w-2.5 rounded-full transition-opacity" style={{ background: t.color, opacity: on ? 1 : 0.4 }} />
                          {TR(t.labelKey)}
                        </span>
                        <span className="font-mono text-xs text-slate-400">{on ? weights[t.key] : TR('testenv.doors.off')}</span>
                      </button>
                      <input type="range" min={0} max={100} value={weights[t.key]} disabled={!on}
                        onChange={(e) => setWeights((s) => ({ ...s, [t.key]: +e.target.value }))}
                        className="mt-2 w-full disabled:opacity-30" style={{ accentColor: t.color }} />
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card className="space-y-4">
              <Slider label={TR('testenv.slider.malicious')} value={malicious} suffix="%" valueClass="text-red-500" onChange={setMalicious} min={0} max={100} />
              <Slider label={TR('testenv.slider.rate')} value={rate} suffix={TR('testenv.slider.rateSuffix')} onChange={setRate} min={1} max={30} />
            </Card>

            <div className="flex gap-2">
              <button onClick={() => setRunning((r) => !r)} disabled={!anyEnabled}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-40 ${running ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                {running ? <><Square size={15} /> {TR('testenv.btn.stop')}</> : <><Play size={15} /> {TR('testenv.btn.start')}</>}
              </button>
              <button onClick={() => tick(true)} disabled={!anyEnabled}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-40">
                <Send size={15} /> 1
              </button>
            </div>
            <button onClick={reset} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700">
              {TR('testenv.btn.reset')}
            </button>
          </div>

          {/* ── визуализация ── */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label={TR('testenv.kpi.sent')} value={stats.sent} color="#0ea5e9" />
              <Kpi label={TR('testenv.kpi.alerts')} value={stats.alerts} color="#f87171" />
              <Kpi label={TR('testenv.kpi.incidents')} value={stats.incidents} color="#fb923c" />
              <Kpi label={TR('testenv.kpi.alertRate')} value={`${alertRate}%`} color="#059669" />
            </div>

            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Activity size={15} className="text-emerald-600" /> {TR('testenv.throughput.title')}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> {TR('testenv.throughput.legendEvents')}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> {TR('testenv.throughput.legendAlerts')}</span>
                </div>
              </div>
              <Throughput series={series} />
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <div className="text-sm font-semibold text-slate-900">{TR('testenv.byType.title')}</div>
                <div className="mt-3 space-y-2.5">
                  {TYPES.map((t) => {
                    const v = byType[t.key] || 0
                    const max = Math.max(1, ...Object.values(byType))
                    return (
                      <div key={t.key} className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-slate-600">{TR(t.labelKey)}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full transition-all" style={{ width: `${(v / max) * 100}%`, background: t.color }} />
                        </div>
                        <span className="w-10 text-right font-mono text-slate-400">{v}</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
              <Card>
                <div className="text-sm font-semibold text-slate-900">{TR('testenv.detectors.title')}</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(byDet).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => (
                    <span key={k} className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{k}: {v}</span>
                  ))}
                  {!Object.keys(byDet).length && <span className="text-xs text-slate-400">{TR('testenv.detectors.empty')}</span>}
                </div>
              </Card>
            </div>

            <Card>
              <div className="text-sm font-semibold text-slate-900">{TR('testenv.feed.title')}</div>
              <div className="mt-2 divide-y divide-slate-100 font-mono text-xs">
                {feed.map((f, i) => (
                  <div key={f.id + i} className="flex items-center gap-2.5 py-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEV_COLOR[f.sev] || '#9ca3af' }} />
                    <span className="w-24 shrink-0 text-slate-600">{(() => { const ft = TYPES.find((t) => t.key === f.type); return ft ? TR(ft.labelKey) : '' })()}</span>
                    <span className="flex-1 truncate text-slate-400">{f.dets.length ? f.dets.join(', ') : '—'}</span>
                    <span className="shrink-0 text-slate-400">{TR('testenv.feed.sev')} {f.sev} · {Number(f.score).toFixed(2)}</span>
                  </div>
                ))}
                {!feed.length && <div className="py-4 text-slate-400">{TR('testenv.feed.empty')}</div>}
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  )
}

function DatasetAttack() {
  const [target, setTarget] = useState('test-key-1')
  const [rows, setRows] = useState(100000)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)

  async function run() {
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch(`${API_BASE}/v1/test/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, rows, dataset: 'paysim' }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j.detail || res.statusText || 'Ошибка запуска атаки')
        return
      }
      setResult(j)
    } catch (e: any) {
      setError(e?.message || 'Сеть недоступна')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Database size={15} className="text-emerald-600" /> Атака с реального датасета
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Реальный датасет PaySim (6.3 млн строк мобильных платежей). Поток уходит в выбранную тест-орг — залогинься её кредами в дашборде, чтобы увидеть инциденты.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-slate-500">Орг-приёмник</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400">
            {TARGETS.map((tg) => (
              <option key={tg.key} value={tg.key}>{tg.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Объём строк</label>
          <select value={rows} onChange={(e) => setRows(+e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400">
            {ATTACK_VOLUMES.map((v) => (
              <option key={v.rows} value={v.rows}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button onClick={run} disabled={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
        {loading
          ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Идёт атака… млн ≈ 20–60с</>
          : <><Play size={15} /> Запустить атаку</>}
      </button>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      {result && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Загружено" value={fmt(result.ingested)} />
          <Stat label="Инцидентов" value={fmt(result.incidents)} />
          <Stat label="Алертов" value={fmt(result.alerts)} />
          <Stat label="Помечено событий" value={fmt(result.flagged_events)} />
          <Stat label="Throughput" value={`${fmt(result.throughput_eps)} ev/s`} />
          <Stat label="Время" value={`${result.elapsed_sec} с`} />
        </div>
      )}
    </Card>
  )
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'bg-sky-100 text-sky-700',
  POST: 'bg-emerald-100 text-emerald-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-violet-100 text-violet-700',
  DELETE: 'bg-red-100 text-red-700',
}

function WebhookConsole() {
  const sinkUrl = `${API_BASE}/v1/test/sink`
  const [listening, setListening] = useState(true)
  const [requests, setRequests] = useState<any[]>([])
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/v1/test/sink/log?limit=50`)
      if (!res.ok) return
      const j = await res.json()
      setRequests(j.requests || [])
    } catch {}
  }

  useEffect(() => {
    if (!listening) return
    load()
    const id = window.setInterval(load, 1500)
    return () => window.clearInterval(id)
  }, [listening])

  const copy = () => {
    navigator.clipboard?.writeText(sinkUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function replay(id: string) {
    try {
      await fetch(`${API_BASE}/v1/test/sink/replay/${id}`, { method: 'POST' })
      load()
    } catch {}
  }

  async function clearLog() {
    try {
      await fetch(`${API_BASE}/v1/test/sink/log`, { method: 'DELETE' })
      setRequests([])
    } catch {}
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Webhook size={15} className="text-emerald-600" /> Консоль вебхуков
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setListening((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${listening ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${listening ? 'animate-pulse bg-white' : 'bg-slate-400'}`} />
            {listening ? 'Слушаю' : 'Слушать'}
          </button>
          <button onClick={clearLog} title="Очистить"
            className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200">
            <Trash2 size={13} /> Очистить
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">Укажите этот URL в правиле реакции (раздел Реакции) — входящие запросы появятся здесь.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{sinkUrl}</code>
        <button onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-200">
          {copied ? <><Check size={13} className="text-emerald-600" /> Скопировано</> : <><Copy size={13} /> Копировать</>}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {requests.map((r) => {
          const isOpen = !!open[r.id]
          return (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white">
              <button onClick={() => setOpen((s) => ({ ...s, [r.id]: !s[r.id] }))}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${METHOD_COLOR[r.method] || 'bg-slate-100 text-slate-700'}`}>{r.method}</span>
                <span className="flex-1 truncate text-xs text-slate-700">{reqTitle(r)}</span>
                <span className="shrink-0 font-mono text-[11px] text-slate-400">{String(r.ts || '').slice(11, 19) || r.ts}</span>
                {typeof r.size === 'number' && <span className="shrink-0 font-mono text-[11px] text-slate-400">{r.size}B</span>}
                <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-slate-100 px-3 py-2.5">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Headers</div>
                    <div className="space-y-0.5 font-mono text-[11px] text-slate-600">
                      {Object.entries(r.headers || {}).map(([k, v]) => (
                        <div key={k} className="break-all"><span className="text-slate-400">{k}:</span> {String(v)}</div>
                      ))}
                      {!Object.keys(r.headers || {}).length && <div className="text-slate-400">—</div>}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Body</div>
                    <pre className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] text-slate-700">{prettyBody(r.body)}</pre>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => replay(r.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-200">
                      <RotateCcw size={13} /> Повторить
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!requests.length && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs text-slate-400">
            <RefreshCw size={18} className="text-slate-300" />
            Запросов ещё не было. Создайте правило реакции с этим URL и нажмите Тест/Отправить.
          </div>
        )}
      </div>
    </Card>
  )
}

function reqTitle(r: any): string {
  if (r?.label) return String(r.label)
  const q = r?.query
  if (q && typeof q === 'object') {
    const keys = Object.keys(q)
    if (keys.length) {
      try { return '?' + new URLSearchParams(q as Record<string, string>).toString() } catch { return JSON.stringify(q) }
    }
  }
  return '/sink'
}

function prettyBody(body: any): string {
  if (body == null || body === '') return '—'
  if (typeof body === 'object') {
    try { return JSON.stringify(body, null, 2) } catch { return String(body) }
  }
  const s = String(body)
  try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s }
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function Slider({ label, value, suffix = '', valueClass = 'text-slate-400', onChange, min, max }: {
  label: string; value: number; suffix?: string; valueClass?: string; onChange: (v: number) => void; min: number; max: number
}) {
  return (
    <div>
      <label className="flex items-center justify-between text-sm text-slate-700">
        <span>{label}</span>
        <span className={`font-mono text-xs ${valueClass}`}>{value}{suffix}</span>
      </label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-2 w-full accent-emerald-600" />
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-medium tabular-nums text-slate-900 sm:text-3xl">{value}</div>
    </div>
  )
}

function Throughput({ series }: { series: { sent: number; alerts: number }[] }) {
  const TR = useT()
  const W = 600, H = 130
  if (!series.length) return <div className="mt-3 grid h-[130px] place-items-center text-sm text-slate-400">{TR('testenv.throughput.empty')}</div>
  const max = Math.max(1, ...series.map((s) => s.sent))
  const n = series.length
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W)
  const y = (v: number) => H - (v / max) * (H - 10) - 5
  const line = (sel: (s: { sent: number; alerts: number }) => number) =>
    series.map((s, i) => `${x(i).toFixed(1)},${y(sel(s)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-[130px] w-full">
      <defs>
        <linearGradient id="tput" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgba(15,23,42,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,${H} ${line((s) => s.sent)} ${W},${H}`} fill="url(#tput)" />
      <polyline points={line((s) => s.sent)} fill="none" stroke="#0ea5e9" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <polyline points={line((s) => s.alerts)} fill="none" stroke="#f87171" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
