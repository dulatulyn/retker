import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Bot, ArrowUp, FilePlus2, Download, X, Loader2 } from 'lucide-react'
import { api } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { CAT_COLOR } from './cat'
import { Flag, Panel, SevBadge, eventCat, fmtTime, sevFromInt } from './ui'

const CATS = ['access', 'anomaly', 'leak', 'fraud', 'phishing', 'normal']
const SEVS = ['crit', 'high', 'med', 'low']

const COL_COUNT = 10

const riskColor = (s: number): string =>
  s >= 0.7 ? '#f87171' : s >= 0.4 ? '#fb923c' : s >= 0.2 ? '#facc15' : '#94a3b8'

const safeTime = (ts: any): string => {
  if (ts == null || ts === '') return '—'
  const t = fmtTime(ts)
  if (!t || t === 'Invalid Date' || /invalid date/i.test(t)) return '—'
  return t
}

const metricVal = (v: any): string => {
  if (v == null) return '—'
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return '—' }
  }
  return String(v)
}

const csvCell = (v: any): string => {
  if (v == null) return '""'
  let s = String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function EventsView({ events, onChanged }: { events: any[]; onChanged: () => void }) {
  const t = useT()
  const [q, setQ] = useState('')
  const [nl, setNl] = useState<any>(null)
  const [cats, setCats] = useState<Set<string>>(new Set())
  const [sevs, setSevs] = useState<Set<string>>(new Set())
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [fu, setFu] = useState<Record<string, { q: string; a: string; busy: boolean }>>({})
  const [creating, setCreating] = useState(false)

  const toggle = (set: Set<string>, v: string, setter: any) => {
    const n = new Set(set)
    n.has(v) ? n.delete(v) : n.add(v)
    setter(n)
  }

  const base: any[] = (nl ? nl.events : events) || []
  const rows = useMemo(
    () => base.filter((e: any) =>
      (cats.size === 0 || cats.has(eventCat(e))) &&
      (sevs.size === 0 || sevs.has(sevFromInt(e.risk?.severity || 1)))).slice(0, 80),
    [base, cats, sevs],
  )

  const visibleIds = useMemo(() => new Set(rows.map((e: any) => e.event_id)), [rows])

  const selIds = useMemo(() => [...sel].filter((id) => visibleIds.has(id)), [sel, visibleIds])
  const selCount = selIds.length

  useEffect(() => {
    setSel((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visibleIds])

  const runNl = async () => {
    setSel(new Set())
    if (!q.trim()) { setNl(null); return }
    try { setNl(await api.query(q)) } catch { setNl(null) }
  }

  const allSel = rows.length > 0 && selCount === rows.length
  const partialSel = selCount > 0 && selCount < rows.length
  const headRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = partialSel
  }, [partialSel])

  const toggleAll = () => setSel(allSel ? new Set() : new Set(rows.map((e: any) => e.event_id)))
  const toggleOne = (id: string) => {
    const n = new Set(sel)
    n.has(id) ? n.delete(id) : n.add(id)
    setSel(n)
  }

  const createIncident = async () => {
    if (!selIds.length || creating) return
    setCreating(true)
    try { await api.fromEvents(selIds); setSel(new Set()); onChanged() } catch {}
    finally { setCreating(false) }
  }
  const exportCsv = () => {
    const cols = ['ts', 'event_class', 'action', 'subject', 'source', 'ip', 'country', 'severity', 'detectors']
    const lines = [cols.join(',')]
    for (const e of rows.filter((x: any) => sel.has(x.event_id))) {
      lines.push([e.ts, e.event_class, e.action, e.actor?.user || e.actor?.account || '',
        e.source || '', e.actor?.ip || '', e.actor?.country || '', e.risk?.severity || 1,
        (e.risk?.detectors || []).join('|')].map(csvCell).join(','))
    }
    const b = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const u = URL.createObjectURL(b); const a = document.createElement('a')
    a.href = u; a.download = 'events.csv'; a.click(); URL.revokeObjectURL(u)
  }

  const askEvent = async (id: string) => {
    const cur = fu[id]?.q?.trim()
    if (!cur) return
    setFu((p) => ({ ...p, [id]: { ...p[id], busy: true, a: '' } }))
    try {
      const r = await api.chat(t('dashviews.events.ask_prefix', { id, q: cur }))
      setFu((p) => ({ ...p, [id]: { q: cur, a: r.reply, busy: false } }))
    } catch {
      setFu((p) => ({ ...p, [id]: { ...p[id], busy: false, a: t('dashviews.events.error') } }))
    }
  }

  return (
    <Panel>
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-semibold">{t('dashviews.events.title')}</h3>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm">
          <Search size={14} className="text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runNl()}
            aria-label={t('dashviews.events.search_aria')}
            placeholder={t('dashviews.events.search_ph')}
            className="w-72 max-w-full bg-transparent text-white/80 outline-none placeholder:text-white/35" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-3">
        {CATS.map((c) => (
          <button key={c} onClick={() => toggle(cats, c, setCats)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${cats.has(c) ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 text-white/50 hover:text-white'}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: CAT_COLOR[c] }} />{t(`dash.cat.${c}`)}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        {SEVS.map((v) => (
          <button key={v} onClick={() => toggle(sevs, v, setSevs)}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${sevs.has(v) ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 text-white/50 hover:text-white'}`}>
            {t(`dash.sev.${v}`)}
          </button>
        ))}
        <span className="ml-auto text-xs text-white/40">{t('dashviews.events.count', { n: rows.length, total: base.length })}</span>
      </div>

      {nl && <div className="border-b border-white/10 bg-brand/5 px-5 py-2.5 text-sm text-white/70">{nl.summary}</div>}

      {selCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-surface-2 px-5 py-2.5 text-sm">
          <span className="text-white/70">{t('dashviews.events.selected', { n: selCount })}</span>
          <button onClick={createIncident} disabled={creating} className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0a8ae6] disabled:opacity-60">{creating ? <Loader2 size={13} className="animate-spin" /> : <FilePlus2 size={13} />} {t('dashviews.events.create_incident')}</button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"><Download size={13} /> {t('dashviews.events.export_csv')}</button>
          <button onClick={() => setSel(new Set())} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-white/50 hover:text-white"><X size={13} /> {t('dashviews.events.unselect')}</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-white/35">
            <tr className="border-b border-white/10">
              <th className="py-3 pl-5 pr-2">
                <input ref={headRef} type="checkbox" checked={allSel} onChange={toggleAll}
                  aria-label={t('dashviews.events.select_all')} className="accent-[#0099ff]" />
              </th>
              <th className="px-3 py-3 font-medium">{t('dashviews.events.col_time')}</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">{t('dashviews.events.col_class')}</th>
              <th className="px-3 py-3 font-medium">{t('dashviews.events.col_action')}</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">{t('dashviews.events.col_subject')}</th>
              <th className="hidden px-3 py-3 font-medium lg:table-cell">{t('dashviews.events.col_source')}</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">{t('dashviews.events.col_ip')}</th>
              <th className="hidden px-3 py-3 font-medium md:table-cell">{t('dashviews.events.col_geo')}</th>
              <th className="px-3 py-3 font-medium">{t('dashviews.events.col_risk')}</th>
              <th className="hidden px-3 py-3 font-medium last:pr-5 md:table-cell">{t('dashviews.events.col_detectors')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {rows.map((e: any) => (
              <FragmentRow key={e.event_id} e={e} t={t}
                selected={sel.has(e.event_id)} onSelect={() => toggleOne(e.event_id)}
                open={open === e.event_id} onOpen={() => setOpen(open === e.event_id ? null : e.event_id)}
                fu={fu[e.event_id]} setFuQ={(v: string) => setFu((p) => ({ ...p, [e.event_id]: { ...(p[e.event_id] || { a: '', busy: false }), q: v } }))}
                ask={() => askEvent(e.event_id)} />
            ))}
            {!rows.length && <tr><td colSpan={COL_COUNT} className="px-5 py-8 text-center text-white/40">{t('dashviews.events.empty')}</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function FragmentRow({ e, t, selected, onSelect, open, onOpen, fu, setFuQ, ask }: any) {
  return (
    <>
      <tr className={`transition-colors hover:bg-white/[0.04] ${open ? 'bg-white/[0.03]' : ''}`}>
        <td className="py-3 pl-5 pr-2" onClick={(ev) => ev.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={onSelect} aria-label={t('dashviews.events.select_one')} className="accent-[#0099ff]" />
        </td>
        <td className="cursor-pointer px-3 py-3 text-white/45" onClick={onOpen}>{safeTime(e.ts)}</td>
        <td className="hidden cursor-pointer px-3 py-3 md:table-cell" onClick={onOpen}><span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">{e.event_class}</span></td>
        <td className="cursor-pointer px-3 py-3 text-white/85" onClick={onOpen}>{e.action}</td>
        <td className="hidden cursor-pointer px-3 py-3 text-white/70 md:table-cell" onClick={onOpen}>{e.actor?.user || e.actor?.account || e.target?.url || '—'}</td>
        <td className="hidden cursor-pointer px-3 py-3 lg:table-cell" onClick={onOpen}>{e.source ? <span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs text-white/55">{e.source}</span> : <span className="text-white/30">—</span>}</td>
        <td className="hidden cursor-pointer px-3 py-3 text-white/45 md:table-cell" onClick={onOpen}>{e.actor?.ip || '—'}</td>
        <td className="hidden cursor-pointer px-3 py-3 text-white/70 md:table-cell" onClick={onOpen}><Flag code={e.actor?.country} /></td>
        <td className="cursor-pointer px-3 py-3" onClick={onOpen}>{e.risk?.score > 0 ? (
          <span className="inline-flex items-center gap-2">
            <span className="tabular-nums font-medium" style={{ color: riskColor(e.risk.score) }}>{Number(e.risk.score).toFixed(2)}</span>
            {e.risk?.severity > 2 && <SevBadge n={e.risk.severity} />}
          </span>
        ) : <span className="text-white/30">—</span>}</td>
        <td className="hidden cursor-pointer px-3 py-3 pr-5 text-white/45 md:table-cell" onClick={onOpen}>{(e.risk?.detectors || []).join(', ') || t('dashviews.events.detector_normal')}</td>
      </tr>
      {open && (
        <tr className="bg-black/30">
          <td colSpan={COL_COUNT} className="px-5 py-4">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-1.5 text-sm">
                <div className="text-xs uppercase tracking-wide text-white/35">{t('dashviews.events.details')}</div>
                {[[t('dashviews.events.f_class'), e.event_class], [t('dashviews.events.f_action'), e.action], [t('dashviews.events.f_subject'), e.actor?.user || e.actor?.account || '—'],
                  [t('dashviews.events.f_source'), e.source || '—'],
                  [t('dashviews.events.f_ip'), e.actor?.ip || '—'], [t('dashviews.events.f_device'), e.actor?.device || '—'], [t('dashviews.events.f_resource'), e.target?.resource || e.target?.url || '—']]
                  .map(([k, v]) => (
                    <div key={k as string} className="flex justify-between gap-4"><span className="text-white/45">{k}</span><span className="text-white/80">{v}</span></div>
                  ))}
                {Object.entries(e.metrics || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4"><span className="text-white/45">{k}</span><span className="text-white/80">{metricVal(v)}</span></div>
                ))}
                {(e.risk?.detectors || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {e.risk.detectors.map((d: string) => <span key={d} className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-white/55">{d}</span>)}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-surface p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-brand"><Bot size={14} /> {t('dashviews.events.ask_ai')}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[t('dashviews.events.sg_dangerous'), t('dashviews.events.sg_whattodo'), t('dashviews.events.sg_similar')].map((s) => (
                    <button key={s} onClick={() => { setFuQ(s); setTimeout(ask, 0) }}
                      className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/55 hover:text-white">{s}</button>
                  ))}
                </div>
                <div className="mt-2 flex items-end gap-2 rounded-lg border border-white/10 bg-black/40 py-1 pl-3 pr-1 focus-within:border-brand/50">
                  <input value={fu?.q || ''} onChange={(ev) => setFuQ(ev.target.value)}
                    onKeyDown={(ev) => ev.key === 'Enter' && ask()}
                    aria-label={t('dashviews.events.ask_aria')}
                    placeholder={t('dashviews.events.ask_ph')}
                    className="flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/35" />
                  <button onClick={ask} disabled={fu?.busy} aria-label={t('dashviews.events.send')} className="grid h-7 w-7 place-items-center rounded-md bg-brand text-white disabled:opacity-40"><ArrowUp size={14} /></button>
                </div>
                {fu?.busy && <div className="mt-2 text-xs text-white/40">{t('dashviews.events.thinking')}</div>}
                {fu?.a && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{fu.a}</p>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
