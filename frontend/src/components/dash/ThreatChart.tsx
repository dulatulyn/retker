import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../../lib/api'
import { CAT_COLOR, RANGES } from './cat'
import { Panel } from './ui'
import { useT } from '../../lib/i18n'

const CATS = ['access', 'anomaly', 'leak', 'fraud', 'phishing', 'normal']

function Tip({ active, payload, label }: any) {
  const t = useT()
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
  return (
    <div className="rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-white">{label}</div>
      {payload.filter((p: any) => p.value > 0).map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-white/70">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {t(`dash.cat.${p.dataKey}`)}: {p.value}
        </div>
      ))}
      <div className="mt-1 border-t border-white/10 pt-1 text-white/50">{t('dashboard.threatchart.total', { total })}</div>
    </div>
  )
}

export function ThreatChart() {
  const t = useT()
  const [range, setRange] = useState('day')
  const [data, setData] = useState<any[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  useEffect(() => {
    api.timeseries(range)
      .then((r) => setData((r.buckets || []).map((b: any) => ({ label: b.label, ...b.by }))))
      .catch(() => {})
  }, [range])

  const visible = CATS.filter((c) => !hidden.has(c))
  const toggle = (c: string) =>
    setHidden((prev) => {
      const n = new Set(prev)
      n.has(c) ? n.delete(c) : n.add(c)
      return n
    })

  return (
    <Panel className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('dashboard.threatchart.title')}</h3>
        <div className="flex gap-0.5 rounded-lg border border-white/10 bg-black/30 p-0.5">
          {RANGES.map(([v]) => (
            <button key={v} onClick={() => setRange(v)}
              className={`rounded-md px-2.5 py-1 text-xs transition ${range === v ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'}`}>
              {t(`dash.range.${v}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 min-h-[224px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
              axisLine={false} tickLine={false} width={34} allowDecimals={false} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<Tip />} />
            {visible.map((c, i) => (
              <Bar key={c} dataKey={c} stackId="a" fill={CAT_COLOR[c]} maxBarSize={28}
                radius={i === visible.length - 1 ? [3, 3, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button key={c} onClick={() => toggle(c)}
            className={`flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs transition hover:bg-white/5 ${hidden.has(c) ? 'opacity-40' : ''}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: CAT_COLOR[c] }} />
            {t(`dash.cat.${c}`)}
          </button>
        ))}
      </div>
    </Panel>
  )
}
