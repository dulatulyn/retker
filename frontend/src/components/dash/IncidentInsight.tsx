import { useState } from 'react'
import { Brain, Loader2, Zap, User, Scale, BookText } from 'lucide-react'
import { API_BASE, getToken } from '../../lib/api'

type Step = {
  action: string
  target?: string
  owner?: string
  executable?: boolean
  sla_minutes?: number
  rationale?: string
}

type Insight = {
  summary?: string
  steps?: Step[]
  confidence?: number
  _model?: string
  _grounded?: boolean
}

const OWNER: Record<string, { label: string; cls: string; icon: any }> = {
  system: { label: 'система', cls: 'bg-emerald-500/15 text-emerald-300', icon: Zap },
  analyst: { label: 'аналитик', cls: 'bg-sky-500/15 text-sky-300', icon: User },
  compliance: { label: 'комплаенс', cls: 'bg-amber-500/15 text-amber-300', icon: Scale },
}

export function IncidentInsight({ incidentId }: { incidentId: string }) {
  const [data, setData] = useState<Insight | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const run = async (force = false) => {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch(`${API_BASE}/v1/incidents/${incidentId}/insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() || ''}` },
        body: JSON.stringify({ force }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText)
      setData(await res.json())
    } catch (e: any) {
      setErr(e?.message || 'Ошибка анализа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/35">
          AI-план реагирования
        </div>
        {data && (
          <button onClick={() => run(true)} disabled={loading}
            className="text-[11px] text-white/40 hover:text-white/70 disabled:opacity-50">
            пересобрать
          </button>
        )}
      </div>

      {!data && (
        <button onClick={() => run(false)} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-brand/15 px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand/25 disabled:opacity-50">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Brain size={15} />}
          {loading ? 'Модель анализирует инцидент…' : 'Сгенерировать AI-анализ'}
        </button>
      )}

      {err && <div className="mt-2 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-sm text-red-300">{err}</div>}

      {data && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-white/70">{data.summary}</p>
          <ol className="space-y-2">
            {(data.steps || []).map((s, i) => {
              const o = OWNER[s.owner || 'analyst'] || OWNER.analyst
              const Icon = o.icon
              return (
                <li key={i} className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] text-white/60">{i + 1}</span>
                    <span className="text-sm font-medium text-white/90">{s.action}</span>
                    {s.target && <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-brand">{s.target}</span>}
                    <span className={`ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${o.cls}`}>
                      <Icon size={11} /> {o.label}
                    </span>
                    {s.executable && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-300">выполнимо</span>}
                    {typeof s.sla_minutes === 'number' && s.sla_minutes > 0 && (
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/45">SLA {s.sla_minutes}м</span>
                    )}
                  </div>
                  {s.rationale && <p className="mt-1.5 pl-7 text-xs leading-relaxed text-white/45">{s.rationale}</p>}
                </li>
              )
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/35">
            <span className="flex items-center gap-1"><Brain size={11} /> {data._model || 'модель'}</span>
            {data._grounded && <span className="flex items-center gap-1 text-violet-300"><BookText size={11} /> RAG-плейбук</span>}
            {typeof data.confidence === 'number' && <span>уверенность {Math.round(data.confidence * 100)}%</span>}
          </div>
        </div>
      )}
    </div>
  )
}
