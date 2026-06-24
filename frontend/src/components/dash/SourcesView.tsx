import { useEffect, useState } from 'react'
import { Copy, Check, Trash2, KeyRound, Radio, Plus } from 'lucide-react'
import { api } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { Panel, fmtTime } from './ui'

const SCOPES = ['ingest', 'read', 'full']
const scopeChip: Record<string, string> = {
  full: 'bg-brand/15 text-brand',
  ingest: 'bg-emerald-500/15 text-emerald-300',
  read: 'bg-amber-500/15 text-amber-300',
}
const mask = (k: string) => (k.length > 12 ? k.slice(0, 10) + '••••••' : k)

export function SourcesView() {
  const t = useT()
  const [sources, setSources] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [scope, setScope] = useState('ingest')
  const [busy, setBusy] = useState(false)
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = async () => {
    try { const r = await api.sources(); setSources(r.sources || []) } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    const n = name.trim()
    if (!n || busy) return
    setBusy(true)
    try {
      const s = await api.createSource(n, scope)
      setNewKey({ name: s.name, key: s.key })
      setName('')
      await load()
    } finally { setBusy(false) }
  }
  const revoke = async (id: string) => {
    if (!window.confirm(t('dashviews.sources.revoke_confirm'))) return
    try { await api.deleteSource(id); load() } catch {}
  }
  const copy = (key: string, id: string) => {
    navigator.clipboard?.writeText(key)
    setCopied(id)
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500)
  }

  const active = sources.filter((s) => !s.revoked)

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand"><KeyRound size={16} /></span>
          <div>
            <h3 className="font-semibold">{t('dashviews.sources.new_title')}</h3>
            <p className="text-sm text-white/45">{t('dashviews.sources.new_desc_1')}<span className="text-white/70">X-Org-Key</span>{t('dashviews.sources.new_desc_2')}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wide text-white/40">{t('dashviews.sources.name_label')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder={t('dashviews.sources.name_ph')}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand/60" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-white/40">{t('dashviews.sources.scope_label')}</label>
            <div className="mt-1.5 flex gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
              {SCOPES.map((s) => (
                <button key={s} onClick={() => setScope(s)} title={t(`dashviews.sources.scope_${s}_desc`)}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${scope === s ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}>
                  {t(`dashviews.sources.scope_${s}_label`)}
                </button>
              ))}
            </div>
          </div>
          <button onClick={create} disabled={busy || !name.trim()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0a8ae6] disabled:opacity-50">
            <Plus size={15} /> {busy ? t('dashviews.sources.creating') : t('dashviews.sources.create_key')}
          </button>
        </div>

        {newKey && (
          <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-300"><Check size={14} /> {t('dashviews.sources.key_created', { name: newKey.name })}</div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-black/40 px-3 py-2 text-sm text-white/85">{newKey.key}</code>
              <button onClick={() => copy(newKey.key, 'new')}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15">
                {copied === 'new' ? <><Check size={13} /> {t('dashviews.sources.copied')}</> : <><Copy size={13} /> {t('dashviews.sources.copy')}</>}
              </button>
            </div>
            <p className="mt-2 text-xs text-white/45">{t('dashviews.sources.send_hint_1')}<span className="text-white/70">X-Org-Key</span>{t('dashviews.sources.send_hint_2')}<span className="text-white/70">/v1/events/*</span>{t('dashviews.sources.send_hint_3')}</p>
          </div>
        )}
      </Panel>

      <Panel>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="font-semibold">{t('dashviews.sources.title')}</h3>
          <span className="text-xs text-white/40">{t('dashviews.sources.stats', { active: active.length, total: sources.length })}</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-white/40">{t('dashviews.sources.loading')}</div>
        ) : !sources.length ? (
          <div className="px-5 py-10 text-center text-sm text-white/40">{t('dashviews.sources.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/35">
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3 font-medium">{t('dashviews.sources.col_source')}</th>
                  <th className="px-3 py-3 font-medium">{t('dashviews.sources.col_scope')}</th>
                  <th className="hidden px-3 py-3 font-medium md:table-cell">{t('dashviews.sources.col_key')}</th>
                  <th className="px-3 py-3 font-medium">{t('dashviews.sources.col_events')}</th>
                  <th className="hidden px-3 py-3 font-medium lg:table-cell">{t('dashviews.sources.col_activity')}</th>
                  <th className="px-3 py-3 pr-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {sources.map((s) => (
                  <tr key={s.id} className={`transition-colors hover:bg-white/[0.03] ${s.revoked ? 'opacity-45' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 text-white/85">
                        <Radio size={14} className={s.revoked ? 'text-white/30' : 'text-emerald-400'} />
                        {s.name}
                        {s.revoked && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white/45">{t('dashviews.sources.revoked')}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${scopeChip[s.scope] || 'bg-white/10 text-white/50'}`}>{SCOPES.includes(s.scope) ? t(`dashviews.sources.scope_${s.scope}_label`) : s.scope}</span>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-black/40 px-2 py-1 text-xs text-white/60">{mask(s.key)}</code>
                        <button onClick={() => copy(s.key, s.id)} aria-label={t('dashviews.sources.copy_key_aria')}
                          className="grid h-7 w-7 place-items-center rounded-md text-white/45 hover:bg-white/5 hover:text-white">
                          {copied === s.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white/70">{s.event_count}</td>
                    <td className="hidden px-3 py-3 text-white/45 lg:table-cell">{s.last_seen ? fmtTime(s.last_seen) : '—'}</td>
                    <td className="px-3 py-3 pr-5 text-right">
                      {!s.revoked && (
                        <button onClick={() => revoke(s.id)} aria-label={t('dashviews.sources.revoke_key_aria')}
                          className="grid h-7 w-7 place-items-center rounded-md text-white/40 hover:bg-red-500/10 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
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
