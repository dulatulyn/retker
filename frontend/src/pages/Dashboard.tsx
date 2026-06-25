import { useCallback, useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, ShieldAlert, Activity, Sparkles, SlidersHorizontal,
  Settings, Bell, ArrowLeft, Bot as BotIcon, ChevronRight, LogOut, ShieldCheck, Download,
  Menu, X, Loader2, Ban, Lock, KeyRound, Upload, Zap, Play,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { ThreatChart } from '../components/dash/ThreatChart'
import { AiChatPanel } from '../components/dash/AiChatPanel'
import { EventsView } from '../components/dash/EventsView'
import { GlobalSearch } from '../components/dash/GlobalSearch'
import { SeverityDonut } from '../components/dash/SeverityDonut'
import { OverviewCharts } from '../components/dash/OverviewCharts'
import { SourcesView } from '../components/dash/SourcesView'
import { ImportView } from '../components/dash/ImportView'
import { ReactionsView } from '../components/dash/ReactionsView'
import { IncidentActions } from '../components/dash/IncidentActions'
import { IncidentInsight } from '../components/dash/IncidentInsight'
import { SevBadge, ScoreBadge, StatusBadge, Panel, fmtTime } from '../components/dash/ui'
import { CAT_COLOR } from '../components/dash/cat'
import { api, API_BASE, getToken } from '../lib/api'
import { useAuth } from '../lib/auth'

function mdInline(s: string): any[] {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="rounded bg-white/10 px-1 py-0.5 text-[12px]">{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}

function Md({ text }: { text: string }) {
  const blocks: any[] = []
  let list: string[] = []
  const flush = (k: any) => {
    if (!list.length) return
    blocks.push(<ul key={'l' + k} className="my-1 list-disc space-y-1 pl-5 marker:text-white/30">{list.map((it, j) => <li key={j} className="text-white/70">{mdInline(it)}</li>)}</ul>)
    list = []
  }
  text.split('\n').forEach((ln, i) => {
    if (ln.startsWith('- ')) { list.push(ln.slice(2)); return }
    flush(i)
    if (ln.startsWith('### ')) blocks.push(<h5 key={i} className="mt-3 text-sm font-semibold text-white">{mdInline(ln.slice(4))}</h5>)
    else if (ln.startsWith('## ')) blocks.push(<h4 key={i} className="mt-4 text-[15px] font-semibold text-white">{mdInline(ln.slice(3))}</h4>)
    else if (ln.startsWith('# ')) blocks.push(<h3 key={i} className="text-base font-bold text-white">{mdInline(ln.slice(2))}</h3>)
    else if (ln.trim().startsWith('---')) blocks.push(<hr key={i} className="my-3 border-white/10" />)
    else if (ln.trim() === '') blocks.push(<div key={i} className="h-1.5" />)
    else blocks.push(<p key={i} className="text-white/75">{mdInline(ln)}</p>)
  })
  flush('end')
  return <div>{blocks}</div>
}

const TL_COLORS: [RegExp, string][] = [
  [/cash_out|transfer|payment|обнал|перевод|transaction|fraud/i, '#00bb88'],
  [/login|access|вход|brute|impossible/i, '#0099ff'],
  [/export|bulk|выгруз|data|ueba|dlp|иин/i, '#8b5cf6'],
  [/email|phish|письм|почт|домен/i, '#f59e0b'],
]
function tlColor(label: string): string {
  for (const [re, c] of TL_COLORS) if (re.test(label || '')) return c
  return '#9ca3af'
}
import { useT } from '../lib/i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data?.length) return null
  const max = Math.max(...data, 1)
  const W = 100, H = 30
  const step = data.length > 1 ? W / (data.length - 1) : W
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(H - (v / max) * (H - 4) - 2).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-8 w-full">
      <polygon points={`0,${H} ${pts.join(' ')} ${W},${H}`} fill={color} opacity={0.12} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5}
        vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Kpi = { label: string; value: number; Icon: any; accent: string; caption?: string; series?: number[] }

function KpiCard({ label, value, Icon, accent, caption, series }: Kpi) {
  return (
    <Panel className="relative overflow-hidden p-4 transition-colors hover:border-white/20 sm:p-5">
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm leading-tight text-white/45">{label}</div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{ background: `${accent}1f`, color: accent }}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-2 text-2xl font-medium tracking-tight tabular-nums sm:text-3xl">{value}</div>
      {series ? <Sparkline data={series} color={accent} /> : <div className="mt-1 text-xs text-white/35">{caption}</div>}
    </Panel>
  )
}

function Overview({ overview, incidents, events, onOpen }:
  { overview: any; incidents: any[]; events: any[]; onOpen: (id: string) => void }) {
  const t = useT()
  if (!overview || !overview.kpis) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 @4xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Panel key={i} className="p-4 sm:p-5">
            <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-white/10" />
          </Panel>
        ))}
      </div>
      <Panel className="grid h-72 place-items-center text-white/30">{t('dashboard.loading.data')}</Panel>
    </div>
  )
  const k = overview.kpis
  const kpis: Kpi[] = [
    { label: t('dashboard.kpi.events24h'), value: k.events_24h, Icon: Activity, accent: '#0099ff', caption: t('dashboard.kpi.events24h.caption'), series: overview.hourly?.length ? overview.hourly : undefined },
    { label: t('dashboard.kpi.openincidents'), value: k.open_incidents, Icon: ShieldAlert, accent: '#f59e0b', caption: t('dashboard.kpi.openincidents.caption') },
    { label: t('dashboard.kpi.blocked'), value: k.blocked, Icon: Ban, accent: '#00bb88', caption: t('dashboard.kpi.blocked.caption') },
    { label: t('dashboard.kpi.leaksprevented'), value: k.leaks_prevented, Icon: Lock, accent: '#8b5cf6', caption: t('dashboard.kpi.leaksprevented.caption') },
  ]
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 @4xl:grid-cols-4">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </div>

      <div className="grid gap-4 @4xl:grid-cols-3">
        <div className="@4xl:col-span-2"><ThreatChart /></div>
        <div className="flex flex-col gap-4">
        <SeverityDonut incidents={incidents} />
        <Panel className="flex-1 p-5">
          <h3 className="font-semibold">{t('dashboard.overview.bytype')}</h3>
          <div className="mt-5 space-y-4">
            {(overview.breakdown || []).map((b: any) => {
              const color = CAT_COLOR[b.category] || '#0099ff'
              return (
                <div key={b.category}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-white/70">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      {t(`dash.cat.${b.category}`)}
                    </span>
                    <span className="text-white/45">{b.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
            {!(overview.breakdown || []).length && <div className="text-sm text-white/40">{t('dashboard.overview.nothreats')}</div>}
          </div>
        </Panel>
        </div>
      </div>

      <OverviewCharts events={events} incidents={incidents} />

      <Panel>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-semibold">{t('dashboard.overview.openincidents')}</h3>
          <span className="text-xs text-white/40">{t('dashboard.overview.total', { count: incidents.length })}</span>
        </div>
        <div className="divide-y divide-white/10">
          {incidents.map((inc) => (
            <button key={inc.id} onClick={() => onOpen(inc.id)}
              className="flex w-full items-center gap-4 px-5 py-3.5 text-left text-sm transition-colors hover:bg-white/[0.03]">
              <SevBadge n={inc.severity} />
              <span className="min-w-0 flex-1 truncate text-white/85">{inc.title}</span>
              <ScoreBadge v={inc.score} />
              <span className="hidden text-white/40 sm:block">{inc.entity}</span>
              <span className="text-white/40">{fmtTime(inc.created_at)}</span>
              <StatusBadge status={inc.status} />
              <ChevronRight size={15} className="text-white/30" />
            </button>
          ))}
          {!incidents.length && <div className="px-5 py-8 text-center text-sm text-white/40">{t('dashboard.overview.noincidents')}</div>}
        </div>
      </Panel>
    </div>
  )
}

function IncidentsView({ incidents, selectedId, setSelectedId, onChanged }:
  { incidents: any[]; selectedId: string | null; setSelectedId: (id: string) => void; onChanged: () => void }) {
  const t = useT()
  const [detail, setDetail] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => { if (!selectedId && incidents.length) setSelectedId(incidents[0].id) }, [incidents, selectedId, setSelectedId])
  useEffect(() => {
    setReport(null)
    if (!selectedId) { setDetail(null); return }
    let ignore = false
    setLoadingDetail(true)
    api.incident(selectedId)
      .then((d) => { if (!ignore) setDetail(d) })
      .catch(() => { if (!ignore) setDetail(null) })
      .finally(() => { if (!ignore) setLoadingDetail(false) })
    return () => { ignore = true }
  }, [selectedId])

  const inc = detail?.incident
  const alerts: any[] = detail?.alerts || []
  const block = async () => {
    if (!selectedId) return
    setBusy(true)
    try { await api.block(selectedId); setDetail(await api.incident(selectedId)); onChanged() } finally { setBusy(false) }
  }
  const closeInc = async () => {
    if (!selectedId) return
    setBusy(true)
    try { await api.bulkIncidents([selectedId], 'close'); setDetail(await api.incident(selectedId)); onChanged() } finally { setBusy(false) }
  }
  const genReport = async () => { if (selectedId) setReport(await api.report(selectedId)) }
  const dl = () => {
    if (!report?.markdown || !inc) return
    const b = new Blob([report.markdown], { type: 'text/markdown' })
    const u = URL.createObjectURL(b); const a = document.createElement('a')
    a.href = u; a.download = `${inc.id}.md`; a.click(); URL.revokeObjectURL(u)
  }
  const dlFile = async (fmt: 'docx' | 'xlsx') => {
    if (!inc) return
    try {
      const res = await fetch(`${API_BASE}/v1/reports/${inc.id}/export?fmt=${fmt}`, {
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      })
      if (!res.ok) return
      const blob = await res.blob()
      const u = URL.createObjectURL(blob); const a = document.createElement('a')
      a.href = u; a.download = `${inc.id}.${fmt}`; a.click(); URL.revokeObjectURL(u)
    } catch { /* ignore */ }
  }

  return (
    <div className="grid gap-4 @3xl:grid-cols-[300px_1fr]">
      <Panel className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">{t('dashboard.incidents.title', { count: incidents.length })}</div>
        <div className="divide-y divide-white/10">
          {incidents.map((i) => (
            <button key={i.id} onClick={() => setSelectedId(i.id)}
              className={`flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${selectedId === i.id ? 'bg-white/[0.05]' : ''}`}>
              <div className="flex items-center gap-2"><SevBadge n={i.severity} /><ScoreBadge v={i.score} /><StatusBadge status={i.status} className="ml-auto" /></div>
              <span className="text-sm text-white/85">{i.title}</span>
              <span className="text-xs text-white/40">{i.entity} · {fmtTime(i.created_at)}</span>
            </button>
          ))}
          {!incidents.length && <div className="px-4 py-8 text-center text-sm text-white/40">{t('dashboard.incidents.empty')}</div>}
        </div>
      </Panel>

      <Panel className="p-6">
        {loadingDetail ? (
          <div className="grid h-64 place-items-center text-white/40"><Loader2 size={20} className="animate-spin" /></div>
        ) : !inc ? <div className="grid h-64 place-items-center text-white/40">{t('dashboard.incidents.select')}</div> : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <SevBadge n={inc.severity} />
              <h3 className="text-lg font-semibold">{inc.title}</h3>
              <ScoreBadge v={inc.score} />
              <StatusBadge status={inc.status} className="ml-auto" />
            </div>

            <div className="mt-6 text-xs uppercase tracking-wide text-white/35">{t('dashboard.incidents.timeline')}</div>
            <div className="mt-3">
              {(inc.timeline || []).map((ev: any, i: number, arr: any[]) => {
                const c = tlColor(ev.label)
                return (
                  <div key={i} className="relative flex items-center gap-3 pb-3 last:pb-0">
                    {i < arr.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-white/10" />}
                    <span className="relative z-10 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-[#111111]" style={{ background: c }} />
                    <span className="w-16 shrink-0 font-mono text-xs text-white/40">{fmtTime(ev.ts)}</span>
                    <span className="rounded-md px-2 py-0.5 text-sm text-white/85" style={{ background: `${c}1a` }}>{ev.label}</span>
                  </div>
                )
              })}
              {!(inc.timeline || []).length && <div className="text-sm text-white/40">—</div>}
            </div>

            <div className="mt-6 rounded-lg border border-white/10 bg-black/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-brand"><BotIcon size={15} /> {t('dashboard.incidents.aiconclusion')}</div>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{inc.ai_summary}</p>
              {inc.hypothesis && <p className="mt-2 text-sm leading-relaxed text-white/45">{inc.hypothesis}</p>}
              {inc.mitre?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {inc.mitre.map((m: string) => <span key={m} className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-white/50">{m}</span>)}
                </div>
              )}
            </div>

            <IncidentInsight incidentId={inc.id} />

            {inc.recommended_actions?.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-white/35">{t('dashboard.incidents.recommendations')}</div>
                <ul className="mt-2 space-y-1.5">
                  {inc.recommended_actions.map((r: string) => (
                    <li key={r} className="flex items-center gap-2 text-sm text-white/70"><ShieldCheck size={13} className="text-brand" /> {r}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={block} disabled={busy || inc.status === 'blocked'}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                {inc.status === 'blocked' ? t('dashboard.incidents.blocked') : t('dashboard.incidents.block')}
              </button>
              <button onClick={genReport} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15">{t('dashboard.incidents.genreport')}</button>
              {inc.status !== 'closed' && (
                <button onClick={closeInc} disabled={busy}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 disabled:opacity-50">
                  {t('dashboard.incidents.close')}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-white/35">{t('dashboard.incidents.blocknote')}</p>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-white/35">Реагирование (SOAR)</div>
              <IncidentActions incidentId={inc.id} onChanged={onChanged} />
            </div>

            {report?.markdown && (
              <div className="mt-5 rounded-lg border border-white/10 bg-black/40">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 text-xs text-white/40">
                  <span>{t('dashboard.incidents.report')}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={dl} className="flex items-center gap-1 hover:text-white"><Download size={13} /> .md</button>
                    <button onClick={() => dlFile('docx')} className="flex items-center gap-1 hover:text-white"><Download size={13} /> Word</button>
                    <button onClick={() => dlFile('xlsx')} className="flex items-center gap-1 hover:text-white"><Download size={13} /> Excel</button>
                  </div>
                </div>
                <div className="max-h-80 overflow-auto px-4 py-3 text-sm leading-relaxed">
                  <Md text={report.markdown} />
                </div>
              </div>
            )}

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="text-xs uppercase tracking-wide text-white/35">{t('dashboard.incidents.alerts', { count: alerts.length })}</div>
              <div className="mt-2 space-y-2">
                {alerts.map((a) => (
                  <div key={a.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2"><SevBadge n={a.severity} /><span className="text-white/80">{a.title}</span></div>
                    <p className="mt-1 text-xs text-white/50">{a.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}

const detectors = [
  ['impossibletravel'],
  ['bruteforce'],
  ['newcountry'],
  ['ueba'],
  ['dlp'],
  ['phishing'],
  ['txscoring'],
] as const

function DetectorsView() {
  const t = useT()
  return (
    <Panel>
      <div className="border-b border-white/10 px-5 py-4 font-semibold">{t('dashboard.detectors.title')}</div>
      <div className="divide-y divide-white/10">
        {detectors.map(([id]) => (
          <div key={id} className="flex items-center gap-4 px-5 py-4 text-sm">
            <div className="flex-1">
              <div className="text-white/85">{t(`dashboard.detectors.${id}.name`)}</div>
              <div className="text-xs text-white/40">{t(`dashboard.detectors.${id}.cat`)} · {t('dashboard.detectors.threshold', { thr: t(`dashboard.detectors.${id}.thr`) })}</div>
            </div>
            <span className="flex h-5 w-9 items-center justify-end rounded-full bg-brand p-0.5"><span className="h-4 w-4 rounded-full bg-white" /></span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function SettingsView({ user, logout }: { user: any; logout: () => void }) {
  const t = useT()
  return (
    <Panel className="max-w-xl p-6">
      <h3 className="font-semibold">{t('dashboard.settings.org')}</h3>
      <div className="mt-4 space-y-3 text-sm">
        <Row label={t('dashboard.settings.orgname')} value={user.org.name} />
        <Row label={t('dashboard.settings.user')} value={user.username} />
        <Row label={t('dashboard.settings.apikey')} value={user.org.api_key} mono />
      </div>
      <button onClick={logout} className="mt-6 flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5">
        <LogOut size={15} /> {t('dashboard.settings.logout')}
      </button>
    </Panel>
  )
}
function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 pb-3">
      <span className="text-white/45">{label}</span>
      <span className={`text-white/80 ${mono ? 'rounded bg-white/10 px-2 py-0.5' : ''}`}>{value}</span>
    </div>
  )
}

const nav = [
  ['Обзор', 'dashboard.nav.overview', LayoutDashboard],
  ['Инциденты', 'dashboard.nav.incidents', ShieldAlert],
  ['События', 'dashboard.nav.events', Activity],
  ['Детекторы', 'dashboard.nav.detectors', SlidersHorizontal],
  ['Источники', 'dashboard.nav.sources', KeyRound],
  ['Импорт', 'Импорт логов', Upload],
  ['Реакции', 'Реакции', Zap],
  ['Настройки', 'dashboard.nav.settings', Settings],
] as const

const VIEW_LABELS: Record<string, string> = Object.fromEntries(nav.map(([v, key]) => [v, key]))

export function Dashboard() {
  const t = useT()
  const { user, loading, logout } = useAuth()
  const [view, setView] = useState('Обзор')
  const [overview, setOverview] = useState<any>(null)
  const [incidents, setIncidents] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menu, setMenu] = useState<'user' | 'bell' | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [replaying, setReplaying] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const [ov, inc, ev] = await Promise.all([api.overview(), api.incidents(), api.events()])
      setOverview(ov); setIncidents(inc); setEvents(ev)
    } catch {}
  }, [])

  const replay = async () => {
    setReplaying(true)
    try { await api.replay() } catch {} finally { setReplaying(false); loadAll() }
  }

  useEffect(() => { if (user) loadAll() }, [user, loadAll])

  useEffect(() => { document.title = `${t(VIEW_LABELS[view] ?? view)} · retker` }, [view, t])

  useEffect(() => {
    if (!user) return
    const es = new EventSource(api.streamUrl())
    es.addEventListener('event', (m: MessageEvent) => {
      try {
        const d = JSON.parse(m.data)
        setEvents((p) => [d, ...p.filter((x: any) => x.event_id !== d.event_id)].slice(0, 80))
      } catch {}
    })
    es.addEventListener('incident', () => {
      api.incidents().then(setIncidents).catch(() => {})
      api.overview().then(setOverview).catch(() => {})
    })
    return () => es.close()
  }, [user])

  if (loading) return <div className="grid min-h-screen place-items-center bg-bg text-white/40">{t('dashboard.loading.app')}</div>
  if (!user) return <Navigate to="/login" replace />

  const openInc = (id: string) => { setSelectedId(id); setView('Инциденты') }

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      {navOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setNavOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-bg transition-transform duration-300 md:sticky md:top-0 md:z-auto md:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-6 w-6 text-white" />
            <span className="text-[18px] font-semibold tracking-tight">retker</span>
          </Link>
          <button onClick={() => setNavOpen(false)} aria-label={t('dashboard.chrome.closemenu')} className="grid h-8 w-8 place-items-center rounded-lg text-white/55 hover:bg-white/5 md:hidden"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {nav.map(([label, labelKey, Icon]) => (
            <button key={label} onClick={() => { setView(label); setNavOpen(false) }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                view === label ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}>
              <Icon size={16} /> {t(labelKey)}
            </button>
          ))}
        </nav>
        <Link to="/" className="flex items-center gap-2 border-t border-white/10 px-5 py-3 text-sm text-white/45 hover:text-white">
          <ArrowLeft size={15} /> {t('dashboard.chrome.tosite')}
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/10 bg-bg/80 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setNavOpen(true)} aria-label={t('dashboard.chrome.openmenu')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/55 hover:bg-white/5 md:hidden"><Menu size={18} /></button>
            <h1 className="truncate font-semibold">{t(VIEW_LABELS[view] ?? view)}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <GlobalSearch incidents={incidents} events={events} onOpenIncident={openInc} onGotoEvents={() => setView('События')} />
            <button onClick={replay} disabled={replaying}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a8ae6] disabled:opacity-60">
              <Play size={14} /> <span className="hidden sm:inline">{replaying ? 'Идёт атака…' : 'Проиграть атаку'}</span><span className="sm:hidden">Атака</span>
            </button>
            <LanguageSwitcher />
            <div className="relative">
              <button onClick={() => setMenu(menu === 'bell' ? null : 'bell')} aria-label={t('dashboard.chrome.notifications')}
                className="relative grid h-8 w-8 place-items-center rounded-lg text-white/55 hover:bg-white/5 hover:text-white">
                <Bell size={17} />
                {incidents.length > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />}
              </button>
              {menu === 'bell' && (
                <div className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-white/10 bg-surface p-2 shadow-2xl">
                  <div className="px-2 py-1.5 text-xs uppercase tracking-wide text-white/35">{t('dashboard.chrome.notifications')}</div>
                  {incidents.slice(0, 4).map((i) => (
                    <button key={i.id} onClick={() => { openInc(i.id); setMenu(null) }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5">
                      <SevBadge n={i.severity} /><span className="flex-1 truncate text-white/80">{i.title}</span>
                    </button>
                  ))}
                  {!incidents.length && <div className="px-2 py-3 text-sm text-white/40">{t('dashboard.chrome.nonew')}</div>}
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => setMenu(menu === 'user' ? null : 'user')} aria-label={t('dashboard.chrome.usermenu')}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs text-white hover:bg-white/15">
                {user.username.slice(0, 2).toUpperCase()}
              </button>
              {menu === 'user' && (
                <div className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-white/10 bg-surface p-2 shadow-2xl">
                  <div className="px-2 py-1.5">
                    <div className="text-sm font-medium text-white">{user.username}</div>
                    <div className="text-xs text-white/40">{user.org.name}</div>
                  </div>
                  <div className="my-1 h-px bg-white/10" />
                  <button onClick={() => { setView('Настройки'); setMenu(null) }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/70 hover:bg-white/5">
                    <Settings size={15} /> {t('dashboard.chrome.settings')}
                  </button>
                  <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-400 hover:bg-red-500/10">
                    <LogOut size={15} /> {t('dashboard.chrome.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {menu && <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} />}

        <main className="@container flex-1 overflow-x-hidden p-4 pb-24 sm:p-6 md:pb-6">
          {view === 'Обзор' && <Overview overview={overview} incidents={incidents} events={events} onOpen={openInc} />}
          {view === 'События' && <EventsView events={events} onChanged={loadAll} />}
          {view === 'Инциденты' && <IncidentsView incidents={incidents} selectedId={selectedId} setSelectedId={setSelectedId} onChanged={loadAll} />}
          {view === 'Детекторы' && <DetectorsView />}
          {view === 'Источники' && <SourcesView />}
          {view === 'Импорт' && <ImportView />}
          {view === 'Реакции' && <ReactionsView />}
          {view === 'Настройки' && <SettingsView user={user} logout={logout} />}
        </main>
      </div>

      {!aiOpen && (
        <button onClick={() => setAiOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-medium text-white shadow-lg shadow-brand/30 transition hover:bg-[#0a8ae6]">
          <Sparkles size={16} /> {t('dashboard.chrome.aianalyst')}
        </button>
      )}
      <AiChatPanel open={aiOpen} onClose={() => setAiOpen(false)} onNavigate={(v) => setView(v)} />
    </div>
  )
}
