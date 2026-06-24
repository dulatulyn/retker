import { sevFromInt, Panel } from './ui'
import { useT } from '../../lib/i18n'

const SEV = [
  { key: 'crit', label: 'dashboard.severitydonut.crit', color: '#ef4444' },
  { key: 'high', label: 'dashboard.severitydonut.high', color: '#fb923c' },
  { key: 'med', label: 'dashboard.severitydonut.med', color: '#eab308' },
  { key: 'low', label: 'dashboard.severitydonut.low', color: '#64748b' },
] as const

export function SeverityDonut({ incidents }: { incidents: any[] }) {
  const t = useT()
  const counts: Record<string, number> = { crit: 0, high: 0, med: 0, low: 0 }
  for (const i of incidents) counts[sevFromInt(i.severity)]++
  const total = incidents.length
  const R = 42
  const C = 2 * Math.PI * R
  let acc = 0
  const segs = SEV.map((s) => {
    const frac = total ? counts[s.key] / total : 0
    const seg = { ...s, n: counts[s.key], dash: frac * C, offset: acc }
    acc += frac * C
    return seg
  })

  return (
    <Panel className="p-5">
      <h3 className="font-semibold">{t('dashboard.severitydonut.title')}</h3>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-[110px] w-[110px] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            {total > 0 && segs.map((s) => (
              <circle key={s.key} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="10"
                strokeDasharray={`${s.dash} ${C - s.dash}`} strokeDashoffset={-s.offset} strokeLinecap="butt" />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums leading-none">{total}</span>
            <span className="mt-0.5 text-[11px] text-white/40">{t('dashboard.severitydonut.total')}</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {segs.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-white/65">{t(s.label)}</span>
              <span className="ml-auto tabular-nums text-white/45">{s.n}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}
