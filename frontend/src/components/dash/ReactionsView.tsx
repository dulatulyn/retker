import { useEffect, useState } from 'react'
import {
  Zap, Plus, Trash2, FlaskConical, RefreshCw, Webhook,
  CheckCircle2, XCircle, Send,
} from 'lucide-react'
import { API_BASE, getToken } from '../../lib/api'
import { Panel, SevBadge, fmtTime } from './ui'

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

type Rule = {
  id: string
  name: string
  enabled: boolean
  mode: 'manual' | 'auto'
  trigger: { min_severity: number; category: string | null; detector: string | null; min_score: number }
  action: { method: string; url: string; headers: Record<string, string>; body_template: string; body_mode?: string }
}

type Audit = {
  ts: string
  rule_name: string
  incident_id: string
  method: string
  url: string
  status_code: number | null
  ok: boolean
  response_snippet: string
  dry_run?: boolean
}

const CATEGORIES = ['', 'access', 'anomaly', 'leak', 'fraud', 'phishing']
const METHODS = ['POST', 'PUT', 'GET', 'PATCH', 'DELETE']
const DEFAULT_BODY = `{
  "incident_id": "{{incident.id}}",
  "title": "{{incident.title}}",
  "entity": "{{entity}}",
  "severity": {{severity}},
  "score": {{score}},
  "category": "{{category}}",
  "actor_ip": "{{actor.ip}}"
}`
const PLACEHOLDERS = [
  '{{incident.id}}', '{{incident.title}}', '{{entity}}',
  '{{severity}}', '{{score}}', '{{category}}', '{{actor.ip}}',
]

const input =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-brand/60'
const label = 'text-xs uppercase tracking-wide text-white/40'

export function ReactionsView() {
  const [rules, setRules] = useState<Rule[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [testOut, setTestOut] = useState<Record<string, any>>({})

  const [name, setName] = useState('')
  const [minSev, setMinSev] = useState(4)
  const [category, setCategory] = useState('')
  const [detector, setDetector] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [method, setMethod] = useState('POST')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState('')
  const [body, setBody] = useState(DEFAULT_BODY)
  const [bodyMode, setBodyMode] = useState<'template' | 'ai'>('template')
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')

  const switchBodyMode = (m: 'template' | 'ai') => {
    setBodyMode(m)
    if (m === 'ai' && body.trim() === DEFAULT_BODY.trim()) setBody('')
    if (m === 'template' && !body.trim()) setBody(DEFAULT_BODY)
  }

  const load = async () => {
    try {
      const [r, a] = await Promise.all([
        rfetch('/v1/reactions'),
        rfetch('/v1/reactions/audit?limit=100'),
      ])
      setRules(r.rules || [])
      setAudit(a.audit || [])
    } catch (e: any) {
      setErr(e.message || 'Ошибка загрузки')
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const parseHeaders = (text: string): Record<string, string> => {
    const t = text.trim()
    if (!t) return {}
    try { const o = JSON.parse(t); if (o && typeof o === 'object') return o } catch {}
    const out: Record<string, string> = {}
    for (const line of t.split('\n')) {
      const i = line.indexOf(':')
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
    return out
  }

  const create = async () => {
    if (!url.trim() || busy) return
    setBusy(true); setErr('')
    try {
      await rfetch('/v1/reactions', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || 'Реакция',
          enabled: true,
          mode,
          trigger: {
            min_severity: minSev,
            category: category || null,
            detector: detector.trim() || null,
            min_score: minScore,
          },
          action: { method, url: url.trim(), headers: parseHeaders(headers), body_template: body, body_mode: bodyMode },
        }),
      })
      setName(''); setUrl(''); setHeaders(''); setDetector('')
      setBody(DEFAULT_BODY); setBodyMode('template'); setMode('manual'); setCategory(''); setMinSev(4); setMinScore(0)
      await load()
    } catch (e: any) {
      setErr(e.message || 'Не удалось создать правило')
    } finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    if (!window.confirm('Удалить правило?')) return
    try { await rfetch(`/v1/reactions/${id}`, { method: 'DELETE' }); load() } catch (e: any) { setErr(e.message) }
  }

  const test = async (id: string, send = false) => {
    setTestOut((p) => ({ ...p, [id]: { loading: true } }))
    try {
      const r = await rfetch(`/v1/reactions/${id}/test`, {
        method: 'POST', body: JSON.stringify({ send }),
      })
      setTestOut((p) => ({ ...p, [id]: r }))
      if (send) load()
    } catch (e: any) {
      setTestOut((p) => ({ ...p, [id]: { error: e.message || 'Ошибка' } }))
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand"><Zap size={16} /></span>
          <div>
            <h3 className="font-semibold">Новое правило реакции</h3>
            <p className="text-sm text-white/45">КОГДА критическое событие → ОТПРАВИТЬ запрос (вебхук) в вашу систему</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className={label}>Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напр. «Блокировка по утечке»" className={`mt-1.5 ${input}`} />
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-white/50">Триггер (когда)</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={label}>Мин. severity</label>
                <select value={minSev} onChange={(e) => setMinSev(Number(e.target.value))} className={`mt-1.5 ${input}`}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Категория</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={`mt-1.5 ${input}`}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c || 'любая'}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Детектор</label>
                <input value={detector} onChange={(e) => setDetector(e.target.value)} placeholder="напр. dlp" className={`mt-1.5 ${input}`} />
              </div>
              <div>
                <label className={label}>Мин. score</label>
                <input type="number" step="0.05" min="0" max="1" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className={`mt-1.5 ${input}`} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/50">
              <Webhook size={13} /> Действие (отправить)
            </div>
            <div className="mt-3 grid gap-3">
              <div className="flex gap-3">
                <div className="w-32 shrink-0">
                  <label className={label}>Метод</label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className={`mt-1.5 ${input}`}>
                    {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className={label}>URL вебхука</label>
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-system.kz/api/soc/webhook" className={`mt-1.5 ${input}`} />
                </div>
              </div>
              <div>
                <label className={label}>Заголовки (Key: Value построчно или JSON)</label>
                <textarea value={headers} onChange={(e) => setHeaders(e.target.value)} rows={2} placeholder={'Authorization: Bearer xxx\nX-Source: retker'} className={`mt-1.5 font-mono text-xs ${input}`} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className={label}>{bodyMode === 'ai' ? 'Инструкция для ИИ (опц.)' : 'Шаблон тела (JSON)'}</label>
                  <div className="flex gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5">
                    {(['template', 'ai'] as const).map((m) => (
                      <button key={m} type="button" onClick={() => switchBodyMode(m)}
                        className={`rounded-md px-2.5 py-1 text-xs transition ${bodyMode === m ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'}`}>
                        {m === 'template' ? 'Шаблон' : 'ИИ (динамич.)'}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={bodyMode === 'ai' ? 3 : 8}
                  placeholder={bodyMode === 'ai' ? 'напр. «сформируй команду на заморозку счёта с указанием суммы и причины»' : undefined}
                  className={`mt-1.5 font-mono text-xs ${input}`} />
                {bodyMode === 'ai' ? (
                  <p className="mt-2 text-[11px] text-white/45">
                    ИИ соберёт JSON-команду под тип угрозы по параметрам инцидента (severity, категория, сущность, индикаторы).
                    Если модель недоступна — детерминированный шаблон.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PLACEHOLDERS.map((p) => (
                      <button key={p} type="button" onClick={() => setBody((b) => b + p)}
                        className="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-white/55 hover:bg-white/10 hover:text-white">
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className={label}>Режим</label>
              <div className="mt-1.5 flex gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
                {(['manual', 'auto'] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`rounded-md px-3 py-1.5 text-sm transition ${mode === m ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}>
                    {m === 'manual' ? 'Ручной' : 'Авто'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={create} disabled={busy || !url.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0a8ae6] disabled:opacity-50">
              <Plus size={15} /> {busy ? 'Сохранение…' : 'Создать правило'}
            </button>
          </div>

          {err && <div className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3 py-2 text-sm text-red-300">{err}</div>}
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-semibold">Правила реакций</h3>
          <span className="text-xs text-white/40">{rules.length} шт.</span>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-white/40">Загрузка…</div>
        ) : !rules.length ? (
          <div className="px-5 py-10 text-center text-sm text-white/40">Пока нет правил. Создайте первое выше.</div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {rules.map((r) => {
              const out = testOut[r.id]
              return (
                <div key={r.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white/90">{r.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${r.mode === 'auto' ? 'bg-brand/15 text-brand' : 'bg-white/10 text-white/50'}`}>
                      {r.mode === 'auto' ? 'Авто' : 'Ручной'}
                    </span>
                    {r.action.body_mode === 'ai' && (
                      <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-violet-500/15 text-violet-300">ИИ-ответ</span>
                    )}
                    {r.enabled
                      ? <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-emerald-500/15 text-emerald-300">вкл</span>
                      : <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-white/10 text-white/45">выкл</span>}
                    <div className="ml-auto flex items-center gap-1.5">
                      <button onClick={() => test(r.id, false)} title="Dry-run без отправки"
                        className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15">
                        <FlaskConical size={13} /> Тест
                      </button>
                      <button onClick={() => test(r.id, true)} title="Отправить реальный запрос"
                        className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15">
                        <Send size={13} /> Отправить
                      </button>
                      <button onClick={() => remove(r.id)} aria-label="Удалить"
                        className="grid h-7 w-7 place-items-center rounded-md text-white/40 hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/50">
                    <span className="text-white/40">Когда:</span>
                    <SevBadge n={r.trigger.min_severity} /> и выше
                    {r.trigger.category && <span className="rounded bg-white/10 px-1.5 py-0.5">{r.trigger.category}</span>}
                    {r.trigger.detector && <span className="rounded bg-white/10 px-1.5 py-0.5">det: {r.trigger.detector}</span>}
                    {r.trigger.min_score > 0 && <span className="rounded bg-white/10 px-1.5 py-0.5">score ≥ {r.trigger.min_score}</span>}
                    <span className="text-white/30">→</span>
                    <span className="font-mono text-white/55">{r.action.method} {r.action.url}</span>
                  </div>

                  {out && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
                      {out.loading && <span className="text-white/45">Выполняется…</span>}
                      {out.error && <span className="text-red-300">{out.error}</span>}
                      {out.rendered && (
                        <>
                          <div className="flex items-center gap-2 text-white/55">
                            {out.matches
                              ? <span className="text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 size={12} /> совпадает</span>
                              : <span className="text-amber-300 inline-flex items-center gap-1"><XCircle size={12} /> не совпадает (тест на примере)</span>}
                            <span className="text-white/35">инцидент: {out.incident_id}</span>
                          </div>
                          <div className="mt-1 text-white/40">Будет отправлено ({out.rendered.method} {out.rendered.url}):</div>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-white/70">{out.rendered.request_body || '(пустое тело)'}</pre>
                          {out.sent && (
                            <div className={`mt-2 rounded px-2 py-1 ${out.sent.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                              Ответ: {out.sent.status_code ?? '—'} · {out.sent.response_snippet}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-semibold">Журнал срабатываний</h3>
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15">
            <RefreshCw size={13} /> Обновить
          </button>
        </div>
        {!audit.length ? (
          <div className="px-5 py-10 text-center text-sm text-white/40">Срабатываний ещё не было.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/35">
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 font-medium">Время</th>
                  <th className="px-3 py-3 font-medium">Правило</th>
                  <th className="px-3 py-3 font-medium">Инцидент</th>
                  <th className="hidden px-3 py-3 font-medium lg:table-cell">Запрос</th>
                  <th className="px-3 py-3 font-medium">Статус</th>
                  <th className="px-3 py-3 pr-5 font-medium">Ответ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {audit.map((a, i) => (
                  <tr key={i} className="transition-colors hover:bg-white/[0.03]">
                    <td className="px-5 py-3 text-white/45">{fmtTime(a.ts)}</td>
                    <td className="px-3 py-3 text-white/80">{a.rule_name}</td>
                    <td className="px-3 py-3 font-mono text-xs text-white/55">{a.incident_id}</td>
                    <td className="hidden px-3 py-3 font-mono text-xs text-white/50 lg:table-cell">{a.method} {a.url}</td>
                    <td className="px-3 py-3">
                      {a.ok
                        ? <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] text-emerald-300"><CheckCircle2 size={11} /> {a.status_code ?? 'ok'}</span>
                        : <span className="inline-flex items-center gap-1 rounded bg-red-500/15 px-1.5 py-0.5 text-[11px] text-red-300"><XCircle size={11} /> {a.status_code ?? 'fail'}</span>}
                    </td>
                    <td className="px-3 py-3 pr-5 max-w-[280px] truncate text-white/45" title={a.response_snippet}>{a.response_snippet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
