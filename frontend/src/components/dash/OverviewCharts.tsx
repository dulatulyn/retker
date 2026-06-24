import { useMemo } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Flag, Panel } from './ui'
import { useT } from '../../lib/i18n'

const BRAND = '#0099ff'

const isRisky = (e: any) => (e?.risk?.severity || 1) > 1

function Empty() {
  const t = useT()
  return <div className="mt-6 text-sm text-white/40">{t('dashboard.charts.nodata')}</div>
}

function Tip({ active, payload, label, unit = '' }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-white">{label}</div>
      <div className="flex items-center gap-2 text-white/70">
        <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill || BRAND }} />
        {p.value}{unit}
      </div>
    </div>
  )
}

const BUCKET_COLORS = ['#2f3340', '#3f4150', '#f59e0b', '#f97316', '#ef4444']

export function OverviewCharts({ events, incidents }: { events: any[]; incidents: any[] }) {
  const t = useT()
  void incidents

  const evs = Array.isArray(events) ? events : []

  const geo = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of evs) {
      if (!isRisky(e)) continue
      const c = e?.actor?.country
      if (!c) continue
      m.set(c, (m.get(c) || 0) + 1)
    }
    return [...m.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [evs])

  const detectors = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of evs) {
      for (const d of e?.risk?.detectors || []) {
        if (!d) continue
        m.set(d, (m.get(d) || 0) + 1)
      }
    }
    return [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7)
  }, [evs])

  const score = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0]
    const labels = ['0–.2', '.2–.4', '.4–.6', '.6–.8', '.8–1']
    for (const e of evs) {
      const s = e?.risk?.score
      if (typeof s !== 'number' || isNaN(s)) continue
      let i = Math.floor(Math.min(Math.max(s, 0), 0.9999) / 0.2)
      if (i < 0) i = 0
      if (i > 4) i = 4
      buckets[i]++
    }
    return buckets.map((count, i) => ({ label: labels[i], count, color: BUCKET_COLORS[i] }))
  }, [evs])

  const hasScore = score.some((b) => b.count > 0)

  const entities = useMemo(() => {
    const m = new Map<string, { count: number; max: number }>()
    for (const e of evs) {
      if (!isRisky(e)) continue
      const key = e?.actor?.user || e?.actor?.account
      if (!key) continue
      const cur = m.get(key) || { count: 0, max: 0 }
      cur.count++
      cur.max = Math.max(cur.max, e?.risk?.score || 0)
      m.set(key, cur)
    }
    return [...m.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count || b.max - a.max)
      .slice(0, 6)
  }, [evs])

  const entitiesMax = Math.max(1, ...entities.map((e) => e.count))

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel className="p-5">
        <h3 className="font-semibold">{t('dashboard.charts.geo')}</h3>
        {geo.length === 0 ? (
          <Empty />
        ) : (
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={geo} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="country" width={48} axisLine={false} tickLine={false}
                  tick={({ x, y, payload }: any) => (
                    <foreignObject x={(x ?? 0) - 50} y={(y ?? 0) - 9} width={48} height={18}>
                      <div className="flex justify-end text-[11px] text-white/45">
                        <Flag code={payload?.value} />
                      </div>
                    </foreignObject>
                  )} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<Tip unit={t('dashboard.charts.unit.events')} />} />
                <Bar dataKey="count" fill={BRAND} radius={[0, 3, 3, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <h3 className="font-semibold">{t('dashboard.charts.detectors')}</h3>
        {detectors.length === 0 ? (
          <Empty />
        ) : (
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={detectors} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false}
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<Tip />} />
                <Bar dataKey="count" fill={BRAND} radius={[0, 3, 3, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <h3 className="font-semibold">{t('dashboard.charts.scoredist')}</h3>
        {!hasScore ? (
          <Empty />
        ) : (
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={score} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false}
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis width={34} axisLine={false} tickLine={false} allowDecimals={false}
                  tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<Tip unit={t('dashboard.charts.unit.events')} />} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={48}>
                  {score.map((b) => (
                    <Cell key={b.label} fill={b.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel className="p-5">
        <h3 className="font-semibold">{t('dashboard.charts.topentities')}</h3>
        {entities.length === 0 ? (
          <Empty />
        ) : (
          <div className="mt-5 space-y-3">
            {entities.map((e) => (
              <div key={e.name} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-white/80" title={e.name}>{e.name}</span>
                  <span className="shrink-0 tabular-nums text-white/45">
                    {t('dashboard.charts.entitymeta', { count: e.count, max: e.max.toFixed(2) })}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round((e.count / entitiesMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
