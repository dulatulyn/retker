import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Square, Send, ArrowLeft, Activity, Zap } from 'lucide-react'
import { API_BASE } from '../lib/api'
import { Container, Eyebrow } from '../components/ui'
import { useT } from '../lib/i18n'

const TARGETS = [
  { key: 'demo-key-123', label: 'Демо (с данными)', login: 'demo / demo12345' },
  { key: 'test-key-1', label: 'Тест 1 (пустой)', login: 'test1 / test12345' },
  { key: 'test-key-2', label: 'Тест 2 (пустой)', login: 'test2 / test12345' },
  { key: 'test-key-3', label: 'Тест 3 (пустой)', login: 'test3 / test12345' },
]
const TICK_MS = 600

const TYPES = [
  { key: 'access', label: 'Вход', labelKey: 'testenv.type.access', path: '/v1/events/access', color: '#0099ff' },
  { key: 'transaction', label: 'Транзакция', labelKey: 'testenv.type.transaction', path: '/v1/events/transaction', color: '#00bb88' },
  { key: 'data', label: 'Данные', labelKey: 'testenv.type.data', path: '/v1/events/data', color: '#8b5cf6' },
  { key: 'email', label: 'Почта', labelKey: 'testenv.type.email', path: '/v1/events/email', color: '#f59e0b' },
] as const

type TKey = (typeof TYPES)[number]['key']

const SEV_COLOR = ['#6b7280', '#9ca3af', '#facc15', '#fb923c', '#f87171', '#ef4444']

const PRESETS: { name: string; nameKey: string; malicious: number; rate: number; weights: Record<TKey, number> }[] = [
  { name: 'Спокойно', nameKey: 'testenv.preset.calm', malicious: 5, rate: 4, weights: { access: 50, transaction: 30, data: 20, email: 20 } },
  { name: 'Подозрительно', nameKey: 'testenv.preset.suspicious', malicious: 30, rate: 8, weights: { access: 40, transaction: 40, data: 30, email: 30 } },
  { name: 'Атака', nameKey: 'testenv.preset.attack', malicious: 70, rate: 12, weights: { access: 35, transaction: 50, data: 45, email: 30 } },
  { name: 'Шторм', nameKey: 'testenv.preset.storm', malicious: 50, rate: 26, weights: { access: 50, transaction: 50, data: 40, email: 40 } },
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
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <Container className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/app" className="grid h-8 w-8 place-items-center rounded-lg text-white/55 transition-colors hover:bg-white/5 hover:text-white">
              <ArrowLeft size={18} />
            </Link>
            <span className="text-[15px] font-semibold tracking-tight">retker</span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/45">{TR('testenv.header.badge')}</span>
          </div>
          <span className={`flex items-center gap-1.5 text-[11px] ${running ? 'text-emerald-400' : 'text-white/35'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-emerald-400' : 'bg-white/30'}`} />
            {running ? TR('testenv.status.running') : TR('testenv.status.stopped')}
          </span>
        </Container>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="glow-blue pointer-events-none absolute -right-24 -top-24 h-72 w-72 opacity-40" />
        <Container className="relative py-12 sm:py-16">
          <Eyebrow>{TR('testenv.hero.eyebrow')}</Eyebrow>
          <h1 className="mt-3 text-4xl text-white sm:text-5xl">{TR('testenv.hero.title')}</h1>
          <p className="mt-4 max-w-2xl text-white/55">
            {TR('testenv.hero.desc')}
          </p>
        </Container>
      </section>

      <Container className="grid gap-5 py-8 lg:grid-cols-[340px_1fr]">
        {/* ── управление ── */}
        <div className="space-y-4">
          <Card>
            <div className="text-sm font-semibold">Куда идёт поток</div>
            <p className="mt-1 text-xs text-white/45">Орг-приёмник (по её X-Org-Key). Залогинься этими кредами, чтобы видеть поток в дашборде.</p>
            <div className="mt-3 space-y-1.5">
              {TARGETS.map((tg) => (
                <button key={tg.key} onClick={() => setTarget(tg.key)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition-colors ${target === tg.key ? 'border-brand/50 bg-brand/10 text-white' : 'border-white/10 text-white/60 hover:bg-white/5'}`}>
                  <span>{tg.label}</span>
                  <span className="font-mono text-[11px] text-white/40">{tg.login}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-[11px] text-white/35">X-Org-Key: {target}</p>
          </Card>

          <Card>
            <div className="flex items-center gap-2 text-sm font-medium text-brand">
              <Zap size={15} /> {TR('testenv.presets.title')}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => applyPreset(p)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/60 transition-colors hover:border-white/25 hover:text-white">
                  {TR(p.nameKey)}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">{TR('testenv.doors.title')}</div>
            <div className="mt-3 space-y-2.5">
              {TYPES.map((t) => {
                const on = enabled[t.key]
                return (
                  <div key={t.key} className={`rounded-xl border px-3 py-2.5 transition-colors ${on ? 'border-white/15 bg-white/[0.03]' : 'border-white/[0.06] bg-transparent'}`}>
                    <button onClick={() => setEnabled((s) => ({ ...s, [t.key]: !s[t.key] }))}
                      className="flex w-full items-center justify-between text-sm">
                      <span className={`flex items-center gap-2 ${on ? 'text-white' : 'text-white/40'}`}>
                        <span className="h-2.5 w-2.5 rounded-full transition-opacity" style={{ background: t.color, opacity: on ? 1 : 0.4 }} />
                        {TR(t.labelKey)}
                      </span>
                      <span className="font-mono text-xs text-white/40">{on ? weights[t.key] : TR('testenv.doors.off')}</span>
                    </button>
                    <input type="range" min={0} max={100} value={weights[t.key]} disabled={!on}
                      onChange={(e) => setWeights((s) => ({ ...s, [t.key]: +e.target.value }))}
                      className="mt-2 w-full accent-brand disabled:opacity-30" style={{ accentColor: t.color }} />
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="space-y-4">
            <Slider label={TR('testenv.slider.malicious')} value={malicious} suffix="%" valueClass="text-red-300" onChange={setMalicious} min={0} max={100} />
            <Slider label={TR('testenv.slider.rate')} value={rate} suffix={TR('testenv.slider.rateSuffix')} onChange={setRate} min={1} max={30} />
          </Card>

          <div className="flex gap-2">
            <button onClick={() => setRunning((r) => !r)} disabled={!anyEnabled}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-40 ${running ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'bg-brand text-white hover:bg-[#0a8ae6]'}`}>
              {running ? <><Square size={15} /> {TR('testenv.btn.stop')}</> : <><Play size={15} /> {TR('testenv.btn.start')}</>}
            </button>
            <button onClick={() => tick(true)} disabled={!anyEnabled}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/5 disabled:opacity-40">
              <Send size={15} /> 1
            </button>
          </div>
          <button onClick={reset} className="w-full rounded-xl border border-white/10 px-4 py-2 text-xs text-white/45 transition-colors hover:bg-white/5 hover:text-white/70">
            {TR('testenv.btn.reset')}
          </button>
        </div>

        {/* ── визуализация ── */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label={TR('testenv.kpi.sent')} value={stats.sent} color="#0099ff" />
            <Kpi label={TR('testenv.kpi.alerts')} value={stats.alerts} color="#f87171" />
            <Kpi label={TR('testenv.kpi.incidents')} value={stats.incidents} color="#fb923c" />
            <Kpi label={TR('testenv.kpi.alertRate')} value={`${alertRate}%`} color="#00bb88" />
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Activity size={15} className="text-brand" /> {TR('testenv.throughput.title')}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/45">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> {TR('testenv.throughput.legendEvents')}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400" /> {TR('testenv.throughput.legendAlerts')}</span>
              </div>
            </div>
            <Throughput series={series} />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <div className="text-sm font-semibold">{TR('testenv.byType.title')}</div>
              <div className="mt-3 space-y-2.5">
                {TYPES.map((t) => {
                  const v = byType[t.key] || 0
                  const max = Math.max(1, ...Object.values(byType))
                  return (
                    <div key={t.key} className="flex items-center gap-2 text-xs">
                      <span className="w-20 text-white/55">{TR(t.labelKey)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(v / max) * 100}%`, background: t.color }} />
                      </div>
                      <span className="w-10 text-right font-mono text-white/45">{v}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
            <Card>
              <div className="text-sm font-semibold">{TR('testenv.detectors.title')}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(byDet).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => (
                  <span key={k} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-white/60">{k}: {v}</span>
                ))}
                {!Object.keys(byDet).length && <span className="text-xs text-white/35">{TR('testenv.detectors.empty')}</span>}
              </div>
            </Card>
          </div>

          <Card>
            <div className="text-sm font-semibold">{TR('testenv.feed.title')}</div>
            <div className="mt-2 divide-y divide-white/[0.05] font-mono text-xs">
              {feed.map((f, i) => (
                <div key={f.id + i} className="flex items-center gap-2.5 py-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEV_COLOR[f.sev] || '#6b7280' }} />
                  <span className="w-24 shrink-0 text-white/55">{(() => { const ft = TYPES.find((t) => t.key === f.type); return ft ? TR(ft.labelKey) : '' })()}</span>
                  <span className="flex-1 truncate text-white/40">{f.dets.length ? f.dets.join(', ') : '—'}</span>
                  <span className="shrink-0 text-white/35">{TR('testenv.feed.sev')} {f.sev} · {Number(f.score).toFixed(2)}</span>
                </div>
              ))}
              {!feed.length && <div className="py-4 text-white/30">{TR('testenv.feed.empty')}</div>}
            </div>
          </Card>
        </div>
      </Container>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-surface p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5 ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      {children}
    </div>
  )
}

function Slider({ label, value, suffix = '', valueClass = 'text-white/45', onChange, min, max }: {
  label: string; value: number; suffix?: string; valueClass?: string; onChange: (v: number) => void; min: number; max: number
}) {
  return (
    <div>
      <label className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={`font-mono text-xs ${valueClass}`}>{value}{suffix}</span>
      </label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-2 w-full accent-brand" />
    </div>
  )
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface p-4 ring-1 ring-white/5">
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-1 text-2xl font-medium tabular-nums sm:text-3xl">{value}</div>
    </div>
  )
}

function Throughput({ series }: { series: { sent: number; alerts: number }[] }) {
  const TR = useT()
  const W = 600, H = 130
  if (!series.length) return <div className="mt-3 grid h-[130px] place-items-center text-sm text-white/30">{TR('testenv.throughput.empty')}</div>
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
          <stop offset="0%" stopColor="#0099ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0099ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,${H} ${line((s) => s.sent)} ${W},${H}`} fill="url(#tput)" />
      <polyline points={line((s) => s.sent)} fill="none" stroke="#0099ff" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <polyline points={line((s) => s.alerts)} fill="none" stroke="#f87171" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
