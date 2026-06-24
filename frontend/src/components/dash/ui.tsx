import { useT } from '../../lib/i18n'

export type Sev = 'crit' | 'high' | 'med' | 'low'
export const sevFromInt = (n: number): Sev => (n >= 5 ? 'crit' : n === 4 ? 'high' : n === 3 ? 'med' : 'low')
const sevStyle: Record<Sev, string> = {
  crit: 'bg-red-500/15 text-red-400', high: 'bg-orange-500/15 text-orange-300',
  med: 'bg-yellow-500/15 text-yellow-300', low: 'bg-white/10 text-white/50',
}

export function SevBadge({ n }: { n: number }) {
  const t = useT()
  const s = sevFromInt(n)
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${sevStyle[s]}`}>{t(`dash.sev.${s}`)}</span>
}
export function ScoreBadge({ v }: { v?: number }) {
  const t = useT()
  if (!v || typeof v !== 'number') return null
  return <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[11px] font-semibold text-brand">{t('dash.score')} {v.toFixed(2)}</span>
}

const statusCls: Record<string, string> = {
  open: 'bg-brand/15 text-brand',
  investigating: 'bg-yellow-500/15 text-yellow-300',
  blocked: 'bg-red-500/15 text-red-400',
  closed: 'bg-white/10 text-white/45',
}
export function StatusBadge({ status, className = '' }: { status?: string; className?: string }) {
  const t = useT()
  const key = status || ''
  const cls = statusCls[key] || 'bg-white/10 text-white/45'
  const label = statusCls[key] ? t(`dash.status.${key}`) : status || '—'
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls} ${className}`}>{label}</span>
}
export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-white/10 bg-surface ${className}`}>{children}</div>
}
export function Flag({ code }: { code?: string | null }) {
  if (!code) return <span className="text-white/30">—</span>
  return (
    <span className="inline-flex items-center gap-1.5">
      <img src={`https://flagsapi.com/${code}/flat/32.png`} alt={code} width={20} height={15} className="rounded-[2px]" loading="lazy"
        onError={(e) => { e.currentTarget.style.display = 'none' }} />
      {code}
    </span>
  )
}
export const fmtTime = (ts: string) => {
  const d = new Date(ts)
  return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('ru-RU')
}
export const eventCat = (e: any): string => {
  if ((e.risk?.severity || 1) <= 1) return 'normal'
  const c = e.event_class
  if (c === 'access') return 'access'
  if (c === 'data_activity') {
    const d = (e.risk?.detectors || []).join(' ').toLowerCase()
    return d.includes('dlp') || d.includes('leak') ? 'leak' : 'anomaly'
  }
  if (c === 'transaction') return 'fraud'
  if (c === 'email') return 'phishing'
  return 'normal'
}
