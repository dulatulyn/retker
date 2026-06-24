import { ChevronRight } from 'lucide-react'
import { CAT_COLOR, CAT_LABEL } from './cat'
import { fmtTime } from './ui'

const sevColor = (n: number) =>
  n >= 5 ? '#ef4444' : n >= 4 ? '#fb923c' : n >= 3 ? '#eab308' : n >= 2 ? '#0099ff' : '#64748b'

const NAV: Record<string, string> = {
  search_logs: 'События',
  get_alerts: 'События',
  list_incidents: 'Инциденты',
  get_incident: 'Инциденты',
  get_stats: 'Обзор',
}

function Shell({ title, count, onGo, children }:
  { title: string; count?: number; onGo?: () => void; children: any }) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] uppercase tracking-wide text-white/35">
        <span>{title}{count != null && <span className="ml-1.5 text-white/25">{count}</span>}</span>
        {onGo && (
          <button onClick={onGo} className="flex items-center gap-0.5 normal-case text-brand/80 transition hover:text-brand">
            перейти <ChevronRight size={11} />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Dot({ n }: { n: number }) {
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: sevColor(n) }} />
}

function Stats({ d, onGo }: { d: any; onGo?: () => void }) {
  const chips: [string, number][] = [
    ['события', d.events], ['алерты', d.alerts],
    ['инциденты', d.incidents], ['открытых', d.open_incidents],
  ]
  const cats = Object.entries(d.alerts_by_category || {}) as [string, number][]
  const max = Math.max(1, ...cats.map(([, n]) => n))
  return (
    <Shell title="Сводка" onGo={onGo}>
      <div className="grid grid-cols-4 gap-px bg-white/5">
        {chips.map(([label, v]) => (
          <div key={label} className="bg-[#141414] px-2 py-2 text-center">
            <div className="text-lg font-semibold tabular-nums text-white">{v ?? 0}</div>
            <div className="text-[10px] text-white/40">{label}</div>
          </div>
        ))}
      </div>
      {cats.length > 0 && (
        <div className="space-y-1.5 px-3 py-2.5">
          {cats.map(([cat, n]) => {
            const color = CAT_COLOR[cat] || '#0099ff'
            return (
              <div key={cat} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 truncate text-white/55">{CAT_LABEL[cat] || cat}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: color }} />
                </span>
                <span className="w-5 shrink-0 text-right tabular-nums text-white/45">{n}</span>
              </div>
            )
          })}
        </div>
      )}
    </Shell>
  )
}

function Incidents({ d, onGo }: { d: any; onGo?: () => void }) {
  const rows = (d.incidents || []).slice(0, 6)
  if (!rows.length) return <Shell title="Инциденты" count={0} onGo={onGo}><Empty /></Shell>
  return (
    <Shell title="Инциденты" count={d.count} onGo={onGo}>
      <div className="divide-y divide-white/5">
        {rows.map((i: any) => (
          <div key={i.id} className="flex items-center gap-2 px-3 py-2 text-xs">
            <Dot n={i.severity} />
            <span className="min-w-0 flex-1 truncate text-white/80">{i.title}</span>
            <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 tabular-nums text-white/45">{i.score}</span>
            <span className="shrink-0 text-white/35">{i.status}</span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

function Alerts({ d, onGo }: { d: any; onGo?: () => void }) {
  const rows = (d.alerts || []).slice(0, 6)
  if (!rows.length) return <Shell title="Алерты" count={0} onGo={onGo}><Empty /></Shell>
  return (
    <Shell title="Алерты" count={d.count} onGo={onGo}>
      <div className="divide-y divide-white/5">
        {rows.map((a: any) => (
          <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-xs">
            <Dot n={a.severity} />
            <span className="min-w-0 flex-1 truncate text-white/80">{a.title}</span>
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
              style={{ background: `${CAT_COLOR[a.category] || '#0099ff'}22`, color: CAT_COLOR[a.category] || '#0099ff' }}>
              {CAT_LABEL[a.category] || a.category}
            </span>
          </div>
        ))}
      </div>
    </Shell>
  )
}

function Logs({ d, onGo }: { d: any; onGo?: () => void }) {
  const rows = (d.events || []).slice(-8).reverse()
  if (!rows.length) return <Shell title="Логи событий" count={0} onGo={onGo}><Empty /></Shell>
  return (
    <Shell title="Логи событий" count={d.count} onGo={onGo}>
      <div className="divide-y divide-white/5 font-mono">
        {rows.map((e: any) => (
          <div key={e.event_id} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
            <Dot n={e.severity} />
            <span className="shrink-0 text-white/40">{fmtTime(e.ts)}</span>
            <span className="min-w-0 flex-1 truncate text-white/75">{e.actor || '—'} · {e.action || e.class}</span>
            {e.country && <span className="shrink-0 rounded bg-white/5 px-1 text-white/45">{e.country}</span>}
          </div>
        ))}
      </div>
    </Shell>
  )
}

function IncidentCard({ d, onGo }: { d: any; onGo?: () => void }) {
  if (d.error) return null
  return (
    <Shell title="Инцидент" onGo={onGo}>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <Dot n={d.severity} />
          <span className="min-w-0 flex-1 truncate font-medium text-white/85">{d.title}</span>
          <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-xs tabular-nums text-white/45">{d.score}</span>
        </div>
        {d.ai_summary && <p className="mt-1.5 text-xs leading-relaxed text-white/55">{d.ai_summary}</p>}
        {Array.isArray(d.timeline) && d.timeline.length > 0 && (
          <div className="mt-2.5 space-y-1 border-l border-white/10 pl-2.5">
            {d.timeline.slice(0, 4).map((t: any, n: number) => (
              <div key={n} className="flex gap-2 text-[11px] text-white/55">
                <span className="text-white/35">{fmtTime(t.ts)}</span>
                <span className="min-w-0 truncate">{t.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

function Knowledge({ d }: { d: any }) {
  const rows = (d.results || []).slice(0, 3)
  if (!rows.length) return null
  return (
    <Shell title="База знаний">
      <div className="divide-y divide-white/5">
        {rows.map((r: any, n: number) => (
          <div key={n} className="px-3 py-2">
            <div className="text-xs font-medium text-white/75">{r.title}</div>
            <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-white/45">{r.text}</div>
          </div>
        ))}
      </div>
    </Shell>
  )
}

function Empty() {
  return <div className="px-3 py-3 text-center text-xs text-white/35">Ничего не найдено</div>
}

export function ChatToolBlock({ tool, data, onNavigate }:
  { tool: string; data: any; onNavigate?: (view: string) => void }) {
  if (!data || data.error) return null
  const view = NAV[tool]
  const onGo = onNavigate && view ? () => onNavigate(view) : undefined
  switch (tool) {
    case 'get_stats': return <Stats d={data} onGo={onGo} />
    case 'list_incidents': return <Incidents d={data} onGo={onGo} />
    case 'get_alerts': return <Alerts d={data} onGo={onGo} />
    case 'search_logs': return <Logs d={data} onGo={onGo} />
    case 'get_incident': return <IncidentCard d={data} onGo={onGo} />
    case 'search_knowledge': return <Knowledge d={data} />
    default: return null
  }
}
