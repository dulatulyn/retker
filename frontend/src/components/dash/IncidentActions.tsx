import { useCallback, useEffect, useState } from 'react'
import {
  ShieldX, Snowflake, FolderPlus, FileText, Server,
  CheckCircle2, XCircle, Zap, Loader2, Download, ChevronDown, ChevronRight, History,
} from 'lucide-react'
import { API_BASE, getToken } from '../../lib/api'

async function rfetch(path: string, opts: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  }
  const tok = getToken()
  if (tok) headers.Authorization = `Bearer ${tok}`
  const res = await fetch(API_BASE + path, { ...opts, headers })
  if (!res.ok) {
    let msg = res.statusText
    try { const j = await res.json(); msg = j.detail || msg } catch {}
    throw new Error(msg)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('json') ? res.json() : res.text()
}

type Toast = { kind: 'ok' | 'err' | 'info'; text: string } | null
type ActionRec = { ts: string; kind: string; label: string; meta?: Record<string, any> }
type Str = { markdown: string; filename: string } | null

const fmtTime = (ts: string) => {
  const d = new Date(ts)
  return isNaN(d.getTime()) ? ts : d.toLocaleString('ru-RU')
}

export function IncidentActions({ incidentId, onChanged }: { incidentId: string; onChanged?: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [assignee, setAssignee] = useState('')
  const [str, setStr] = useState<Str>(null)
  const [strOpen, setStrOpen] = useState(true)
  const [actions, setActions] = useState<ActionRec[]>([])
  const [curAssignee, setCurAssignee] = useState<string | null>(null)

  const flash = (t: Toast) => {
    setToast(t)
    if (t) setTimeout(() => setToast((c) => (c === t ? null : c)), 4000)
  }

  const loadActions = useCallback(async () => {
    try {
      const r = await rfetch(`/v1/incidents/${incidentId}/actions`)
      setActions((r.actions || []).slice().reverse())
      setCurAssignee(r.assignee || null)
    } catch {}
  }, [incidentId])

  useEffect(() => { loadActions() }, [loadActions])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
      await loadActions()
      onChanged?.()
    } catch (e: any) {
      flash({ kind: 'err', text: e.message || 'Ошибка' })
    } finally { setBusy(null) }
  }

  const block = () => run('block', async () => {
    await rfetch(`/v1/incidents/${incidentId}/block`, { method: 'POST' })
    flash({ kind: 'ok', text: 'Инцидент заблокирован' })
  })

  const freeze = () => run('freeze', async () => {
    await rfetch(`/v1/incidents/${incidentId}/freeze`, { method: 'POST' })
    flash({ kind: 'ok', text: 'Операция заморожена' })
  })

  const createCase = () => run('case', async () => {
    await rfetch(`/v1/incidents/${incidentId}/case`, {
      method: 'POST', body: JSON.stringify({ assignee: assignee.trim() || undefined }),
    })
    flash({ kind: 'ok', text: assignee.trim() ? `Дело создано · ${assignee.trim()}` : 'Дело создано' })
    setAssignee('')
  })

  const siem = () => run('siem', async () => {
    const r = await rfetch(`/v1/incidents/${incidentId}/siem`, { method: 'POST' })
    flash({ kind: 'ok', text: `Отправлено в SIEM${r.ref ? ` · ${r.ref}` : ''}` })
  })

  const buildStr = () => run('str', async () => {
    const r = await rfetch(`/v1/incidents/${incidentId}/str`, { method: 'POST' })
    setStr({ markdown: r.markdown, filename: r.filename })
    setStrOpen(true)
    flash({ kind: 'ok', text: 'СПО сформировано' })
  })

  const downloadStr = () => {
    if (!str) return
    const blob = new Blob([str.markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = str.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const btn =
    'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50'
  const spin = (k: string, Icon: any) =>
    busy === k ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />

  return (
    <div className="rounded-xl border border-white/10 bg-surface p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">Реагирование</div>

      <div className="flex flex-wrap gap-2">
        <button onClick={block} disabled={!!busy}
          className={`${btn} bg-red-500/15 text-red-300 hover:bg-red-500/25`}>
          {spin('block', ShieldX)} Заблокировать
        </button>

        <button onClick={freeze} disabled={!!busy}
          className={`${btn} bg-white/10 text-white/80 hover:bg-white/15`}>
          {spin('freeze', Snowflake)} Заморозить операцию
        </button>

        <button onClick={siem} disabled={!!busy}
          className={`${btn} bg-white/10 text-white/80 hover:bg-white/15`}>
          {spin('siem', Server)} Отправить в SIEM
        </button>

        <button onClick={buildStr} disabled={!!busy}
          className={`${btn} bg-brand/90 text-white hover:bg-brand`}>
          {spin('str', FileText)} Сформировать СПО
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder={curAssignee ? `Ответственный: ${curAssignee}` : 'Ответственный по делу'}
          className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/85 placeholder:text-white/35 focus:border-brand/50 focus:outline-none"
        />
        <button onClick={createCase} disabled={!!busy}
          className={`${btn} bg-white/10 text-white/80 hover:bg-white/15`}>
          {spin('case', FolderPlus)} Создать дело
        </button>
      </div>

      {toast && (
        <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
          toast.kind === 'ok' ? 'bg-emerald-500/10 text-emerald-300'
            : toast.kind === 'err' ? 'bg-red-500/10 text-red-300'
              : 'bg-white/[0.06] text-white/70'}`}>
          {toast.kind === 'ok' ? <CheckCircle2 size={14} /> : toast.kind === 'err' ? <XCircle size={14} /> : <Zap size={14} />}
          {toast.text}
        </div>
      )}

      {str && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30">
          <div className="flex items-center gap-2 px-3 py-2">
            <button onClick={() => setStrOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-white/80">
              {strOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Предпросмотр СПО
            </button>
            <span className="font-mono text-xs text-white/40">{str.filename}</span>
            <button onClick={downloadStr}
              className={`${btn} ml-auto bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25`}>
              <Download size={14} /> Скачать .md
            </button>
          </div>
          {strOpen && (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-white/10 px-3 py-3 font-mono text-xs leading-relaxed text-white/75">
              {str.markdown}
            </pre>
          )}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/35">
          <History size={13} /> Журнал действий
        </div>
        {actions.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/40">
            Действий пока нет
          </div>
        ) : (
          <div className="space-y-1.5">
            {actions.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
                <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                <span className="text-white/80">{a.label}</span>
                <span className="ml-auto shrink-0 text-white/40">{fmtTime(a.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
