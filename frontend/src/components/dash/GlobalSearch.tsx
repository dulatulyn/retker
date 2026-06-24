import { useEffect, useRef, useState } from 'react'
import { Search, ShieldAlert, Fingerprint, Database, CreditCard, Mail, Activity } from 'lucide-react'
import { api } from '../../lib/api'

const SEV_STYLE: Record<string, string> = {
  критичный: 'bg-red-500/15 text-red-300',
  высокий: 'bg-orange-500/15 text-orange-300',
  средний: 'bg-yellow-500/15 text-yellow-300',
  низкий: 'bg-white/10 text-white/50',
}

const CLASS_ICON: Record<string, any> = {
  access: Fingerprint,
  data_activity: Database,
  transaction: CreditCard,
  email: Mail,
  web: Mail,
}

const EXAMPLES = ['обнал ночью', 'утечка ИИН', 'фишинг домен', 'подозрительные входы']

export function GlobalSearch({ incidents, onOpenIncident, onGotoEvents }: {
  incidents: any[]
  events: any[]
  onOpenIncident: (id: string) => void
  onGotoEvents: () => void
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<number>(0)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (!q.trim()) {
      setData(null)
      setErr(false)
      return
    }
    timer.current = window.setTimeout(async () => {
      setLoading(true)
      setErr(false)
      try {
        setData(await api.search(q))
      } catch {
        setData(null)
        setErr(true)
      }
      setLoading(false)
    }, 160)
    return () => window.clearTimeout(timer.current)
  }, [q])

  const ql = q.trim().toLowerCase()
  const incHits = ql
    ? incidents.filter((i: any) => `${i.title || ''} ${i.entity || ''}`.toLowerCase().includes(ql)).slice(0, 4)
    : []

  const results: any[] = data?.results || []
  const byClass: Record<string, any[]> = {}
  for (const r of results) (byClass[r.event_class] ||= []).push(r)
  const groups = (data?.facets?.by_class || [])
    .map((f: any) => ({ key: f.key, label: f.label, count: f.count, items: byClass[f.key] || [] }))
    .filter((g: any) => g.items.length)

  const pickEvent = () => { setOpen(false); onGotoEvents() }
  const pickInc = (id: string) => { setOpen(false); onOpenIncident(id) }

  return (
    <div ref={ref} className="relative hidden md:block">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Поиск по логам…"
        aria-label="Поиск по логам"
        className="h-9 w-64 rounded-lg border border-white/10 bg-black/30 pl-9 pr-3 text-[13px] text-white outline-none transition-colors placeholder:text-white/35 focus:border-brand/60"
      />

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[32rem] max-w-[88vw] overflow-hidden rounded-xl border border-white/10 bg-surface shadow-2xl shadow-black/50">
          {data && (
            <div className="border-b border-white/10 px-3 py-2 text-[11px] text-white/50">
              Найдено <b className="text-white">{data.total}</b> по «{q.trim()}» · {data.took_ms} мс
            </div>
          )}

          <div className="max-h-[62vh] overflow-y-auto py-1">
            {!ql && (
              <div className="px-3 py-2.5">
                <p className="text-xs text-white/40">Примеры запросов:</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((x) => (
                    <button
                      key={x}
                      onMouseDown={(e) => { e.preventDefault(); setQ(x) }}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/60 transition-colors hover:border-white/20 hover:text-white"
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ql && loading && <div className="px-3 py-4 text-sm text-white/40">Ищу…</div>}
            {ql && err && <div className="px-3 py-4 text-sm text-white/40">Поиск недоступен (сервер не отвечает).</div>}

            {incHits.length > 0 && (
              <Group label="Инциденты" count={incHits.length} icon={ShieldAlert}>
                {incHits.map((i: any) => (
                  <button key={i.id} onClick={() => pickInc(i.id)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/5">
                    <span className="h-6 w-6 shrink-0" />
                    <span className="flex-1 truncate text-sm text-white/85">{i.title}</span>
                    {i.entity && <span className="shrink-0 text-xs text-white/40">{i.entity}</span>}
                  </button>
                ))}
              </Group>
            )}

            {groups.map((g: any) => (
              <Group key={g.key} label={g.label} count={g.count} icon={CLASS_ICON[g.key] || Activity}>
                {g.items.slice(0, 6).map((r: any) => (
                  <button key={r.event_id} onClick={pickEvent}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-white/5">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${SEV_STYLE[r.severity_band] || ''}`}>
                      {r.severity_band}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white/85">
                        {r.action}{r.actor ? ` · ${r.actor}` : ''}
                      </div>
                      <div className="truncate text-[11px] text-white/40">
                        {r.ts}{r.country ? ` · ${r.country}` : ''}{r.detectors?.length ? ` · ${r.detectors.join(', ')}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-white/30">{r.score}</span>
                  </button>
                ))}
                {g.count > g.items.length && (
                  <button onClick={pickEvent} className="px-3 py-1 text-[11px] text-brand hover:underline">
                    ещё {g.count - g.items.length} →
                  </button>
                )}
              </Group>
            ))}

            {ql && !loading && !err && data && results.length === 0 && incHits.length === 0 && (
              <div className="px-3 py-4 text-sm text-white/40">Ничего не найдено по «{q.trim()}».</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Group({ label, count, icon: Icon, children }: {
  label: string
  count: number
  icon: any
  children: React.ReactNode
}) {
  return (
    <div className="py-1">
      <div className="flex items-center gap-2 px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
        <Icon size={13} className="text-white/30" />
        <span>{label}</span>
        <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 text-[10px] text-white/45">{count}</span>
      </div>
      {children}
    </div>
  )
}
