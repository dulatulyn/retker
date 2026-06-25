import { useEffect, useRef, useState } from 'react'
import {
  Upload,
  FileText,
  FileJson,
  FileTerminal,
  Play,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Database,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { API_BASE, getToken } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { Panel } from './ui'

type Fmt = 'csv' | 'json' | 'syslog'

type Preset = {
  key: string
  label: string
  description: string
  event_class: string
  mapping: Record<string, string>
  target_fields: string[]
}

type PreviewResp = {
  headers: string[]
  sample: Record<string, any>[]
  suggested_mapping: Record<string, string>
  target_fields: string[]
  preset?: string | null
}

type ImportResp = {
  ingested: number
  alerts: number
  incidents: number
  flagged_events: number
  elapsed_sec: number
  throughput_eps: number
  preset?: string | null
  aggregates: {
    by_class: Record<string, number>
    by_day: Record<string, number>
    top_actors: [string, number][]
    top_targets: [string, number][]
    total_amount: number
  }
  raw_retained: number
}

const FALLBACK_FIELDS = [
  'ts',
  'event_class',
  'action',
  'actor.user',
  'actor.account',
  'actor.ip',
  'actor.country',
  'target.account',
  'target.resource',
  'metrics.amount',
  'metrics.rows',
  'risk.severity',
  'source',
]

async function apiPost(path: string, body: any): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken() || ''}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      msg = j.detail || msg
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

async function apiGet(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken() || ''}` },
  })
  if (!res.ok) throw new Error(res.statusText)
  return res.json()
}

const SAMPLE_SAML =
  'Time,Date,Sender_account,Receiver_account,Amount,Payment_currency,Sender_bank_location,Receiver_bank_location,Payment_type,Is_laundering,Laundering_type\n' +
  '10:35:19,2022-10-07,8000700,8000800,6230.5,UK pounds,UK,UK,Cash Deposit,0,Normal\n' +
  '10:36:02,2022-10-07,8000701,8000900,98750.0,UK pounds,UK,Nigeria,Cross-border,1,Layering'

const SAMPLE_SYSLOG =
  '2026-06-21T16:40:55.849357+00:00 asynkor sshd-session[137265]: Failed password for invalid user alex from 176.65.132.129 port 38834 ssh2\n' +
  '2026-06-21T16:40:57.812704+00:00 asynkor sshd-session[137305]: Failed password for root from 176.65.132.129 port 38846 ssh2\n' +
  '2026-06-21T16:41:00.792712+00:00 asynkor sshd-session[137345]: Failed password for invalid user amir from 176.65.132.129 port 38848 ssh2\n' +
  '2026-06-21T16:41:03.774231+00:00 asynkor sshd-session[137386]: Failed password for invalid user mysql from 176.65.132.129 port 44480 ssh2\n' +
  '2026-06-21T16:41:08.512004+00:00 asynkor sshd-session[137420]: Failed password for root from 176.65.132.129 port 44512 ssh2\n' +
  '2026-06-21T16:42:01.000000+00:00 asynkor sshd[12345]: Accepted password for ubuntu from 10.0.0.5 port 51000 ssh2'

const SYSLOG_PLACEHOLDER =
  '2026-06-21T00:42:12.159888+00:00 asynkor sshd-session[3670120]: Failed password for invalid user sol from 2.57.122.177 port 56200 ssh2\n' +
  'Jan 10 10:23:45 host sshd[1234]: Failed password for root from 45.198.224.46 port 40398 ssh2'

const fmtNum = (n: number) =>
  new Intl.NumberFormat('ru-RU').format(Math.round(n))

export function ImportView() {
  const { user } = useAuth()
  const isTest =
    !!user &&
    (/^test/i.test(user.username) || /тест|test/i.test(user.org?.name || ''))

  const [fmt, setFmt] = useState<Fmt>('csv')
  const [preset, setPreset] = useState<string>('saml-d')
  const [presets, setPresets] = useState<Preset[]>([])
  const [data, setData] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)

  const [preview, setPreview] = useState<PreviewResp | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [targetFields, setTargetFields] = useState<string[]>(FALLBACK_FIELDS)

  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResp | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [datasets, setDatasets] = useState<{ name: string; label: string; available: boolean }[]>([])
  const [dsRows, setDsRows] = useState(1000000)
  const [loadingDs, setLoadingDs] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    apiGet('/v1/import/presets')
      .then((r) => {
        setPresets(r.presets || [])
        if (r.target_fields) setTargetFields(r.target_fields)
      })
      .catch(() => {})
    apiGet('/v1/import/datasets')
      .then((r) => setDatasets(r.datasets || []))
      .catch(() => {})
  }, [])

  const loadDataset = async (name: string) => {
    if (loadingDs) return
    setLoadingDs(true)
    setError(null)
    setResult(null)
    try {
      const r: ImportResp = await apiPost('/v1/import/dataset', { dataset: name, rows: dsRows })
      setResult(r)
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки датасета')
    } finally {
      setLoadingDs(false)
    }
  }

  const onFile = async (f: File) => {
    const text = await f.text()
    const name = f.name.toLowerCase()
    setData(text)
    setFileName(f.name)
    if (name.endsWith('.json')) {
      setFmt('json')
    } else if (name.endsWith('.log') || name.endsWith('.txt')) {
      setFmt('syslog')
      setPreset('linux-auth')
    } else {
      setFmt('csv')
    }
    setPreview(null)
    setResult(null)
  }

  const doPreview = async () => {
    if (!data.trim() || previewing) return
    setPreviewing(true)
    setError(null)
    setResult(null)
    try {
      const r: PreviewResp = await apiPost('/v1/import/preview', {
        format: fmt,
        preset,
        data,
      })
      setPreview(r)
      if (r.target_fields?.length) setTargetFields(r.target_fields)
      setMapping(r.suggested_mapping || {})
    } catch (e: any) {
      setError(e?.message || 'Ошибка предпросмотра')
    } finally {
      setPreviewing(false)
    }
  }

  const doImport = async () => {
    if (!data.trim() || importing) return
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const r: ImportResp = await apiPost('/v1/import', {
        format: fmt,
        preset,
        mapping,
        data,
      })
      setResult(r)
    } catch (e: any) {
      setError(e?.message || 'Ошибка импорта')
    } finally {
      setImporting(false)
    }
  }

  const setField = (target: string, col: string) =>
    setMapping((m) => {
      const next = { ...m }
      if (col) next[target] = col
      else delete next[target]
      return next
    })

  const headers = preview?.headers || []
  const presetMeta = presets.find((p) => p.key === preset)

  return (
    <div className="space-y-6">
      {isTest && datasets.length > 0 && (
        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand">
              <Database size={16} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Готовые датасеты (на сервере)</h3>
                <span className="rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-500/15 text-amber-300">
                  тестовая среда
                </span>
              </div>
              <p className="text-sm text-white/45">
                Загрузка прямо в систему, без выгрузки файла — потоковая обработка
                до миллионов событий.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {datasets.map((d) => (
              <div
                key={d.name}
                className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm text-white/80">
                  {d.label}
                  {!d.available && (
                    <span className="ml-2 text-xs text-amber-300">(нет файла на сервере)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={dsRows}
                    onChange={(e) => setDsRows(Number(e.target.value))}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-brand/60"
                  >
                    <option value={100000}>100 000</option>
                    <option value={500000}>500 000</option>
                    <option value={1000000}>1 000 000</option>
                  </select>
                  <button
                    onClick={() => loadDataset(d.name)}
                    disabled={!d.available || loadingDs}
                    className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0a8ae6] disabled:opacity-50"
                  >
                    <Play size={15} /> {loadingDs ? 'Загрузка…' : 'Загрузить'}
                  </button>
                </div>
              </div>
            ))}
            {loadingDs && (
              <div className="flex items-center gap-2 text-sm text-white/50">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
                Потоковая обработка… (миллион ≈ 20–60с)
              </div>
            )}
          </div>
        </Panel>
      )}

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand">
            <Upload size={16} />
          </span>
          <div>
            <h3 className="font-semibold">Импорт логов</h3>
            <p className="text-sm text-white/45">
              Загрузите реальные логи (CSV или JSON), сопоставьте колонки с
              моделью OCSF и прогоните через детекторы.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end">
          <div>
            <label className="text-xs uppercase tracking-wide text-white/40">
              Формат
            </label>
            <div className="mt-1.5 flex gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
              {(['csv', 'json', 'syslog'] as Fmt[]).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFmt(f)
                    if (f === 'syslog') {
                      setPreset('linux-auth')
                      setPreview(null)
                      setResult(null)
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${
                    fmt === f
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {f === 'csv' ? (
                    <FileText size={14} />
                  ) : f === 'json' ? (
                    <FileJson size={14} />
                  ) : (
                    <FileTerminal size={14} />
                  )}
                  {f === 'syslog' ? 'Linux логи' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <label className="text-xs uppercase tracking-wide text-white/40">
              Пресет
            </label>
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value)
                setPreview(null)
              }}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand/60"
            >
              {presets.length === 0 && (
                <>
                  <option value="saml-d">SAML-D (AML транзакции)</option>
                  <option value="generic">Generic (универсальный)</option>
                </>
              )}
              {presets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
            >
              <Upload size={15} /> Файл
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json,.txt,.log,text/csv,application/json,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
              }}
            />
          </div>
        </div>

        {presetMeta && (
          <p className="mt-3 text-xs text-white/45">{presetMeta.description}</p>
        )}

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs uppercase tracking-wide text-white/40">
              Данные {fileName ? `· ${fileName}` : '(вставьте или загрузите)'}
            </label>
            {fmt === 'syslog' ? (
              <button
                onClick={() => {
                  setData(SAMPLE_SYSLOG)
                  setFmt('syslog')
                  setPreset('linux-auth')
                  setFileName(null)
                  setPreview(null)
                  setResult(null)
                }}
                className="flex items-center gap-1 text-xs text-brand hover:underline"
              >
                <Sparkles size={12} /> Пример auth.log
              </button>
            ) : (
              <button
                onClick={() => {
                  setData(SAMPLE_SAML)
                  setFmt('csv')
                  setPreset('saml-d')
                  setFileName(null)
                  setPreview(null)
                  setResult(null)
                }}
                className="flex items-center gap-1 text-xs text-brand hover:underline"
              >
                <Sparkles size={12} /> Пример SAML-D
              </button>
            )}
          </div>
          {fmt === 'syslog' ? (
            <div className="overflow-hidden rounded-lg border border-emerald-500/25 bg-black shadow-[inset_0_0_40px_rgba(16,185,129,0.06)]">
              <div className="flex items-center gap-2 border-b border-white/10 bg-[#0c0c0c] px-3 py-1.5">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                </span>
                <span className="ml-1 font-mono text-[11px] text-emerald-300/80">
                  root@retker:~# cat {fileName || '/var/log/auth.log'}
                </span>
              </div>
              <textarea
                value={data}
                onChange={(e) => {
                  setData(e.target.value)
                  setFileName(null)
                }}
                placeholder={SYSLOG_PLACEHOLDER}
                spellCheck={false}
                className="h-56 w-full resize-y bg-black px-4 py-3 font-mono text-xs leading-relaxed text-emerald-300 caret-emerald-400 outline-none placeholder:text-emerald-300/25"
              />
            </div>
          ) : (
            <textarea
              value={data}
              onChange={(e) => {
                setData(e.target.value)
                setFileName(null)
              }}
              placeholder={
                fmt === 'csv'
                  ? 'col1,col2,col3\nval1,val2,val3'
                  : '[{"field": "value"}, ...]'
              }
              spellCheck={false}
              className="h-40 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 font-mono text-xs text-white/85 outline-none transition-colors focus:border-brand/60"
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={doPreview}
            disabled={!data.trim() || previewing}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            <Wand2 size={15} />
            {previewing ? 'Анализ…' : 'Предпросмотр и маппинг'}
          </button>
          <button
            onClick={doImport}
            disabled={!data.trim() || importing}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0a8ae6] disabled:opacity-50"
          >
            <Play size={15} />
            {importing ? 'Импорт…' : 'Импортировать'}
          </button>
          {importing && (
            <span className="flex items-center gap-2 text-sm text-white/50">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-brand" />
              Обработка батчами…
            </span>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.07] px-3 py-2.5 text-sm text-red-300">
            <AlertTriangle size={15} /> {error}
          </div>
        )}
      </Panel>

      {preview && (
        <Panel>
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h3 className="font-semibold">Маппинг колонок → OCSF</h3>
            <span className="text-xs text-white/40">
              {headers.length} колонок · {preview.sample.length} строк превью
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {targetFields.map((tf) => (
              <div key={tf}>
                <label className="text-[11px] font-mono uppercase tracking-wide text-white/40">
                  {tf}
                </label>
                <select
                  value={mapping[tf] || ''}
                  onChange={(e) => setField(tf, e.target.value)}
                  className={`mt-1 w-full rounded-lg border bg-black/40 px-3 py-2 text-sm outline-none transition-colors focus:border-brand/60 ${
                    mapping[tf]
                      ? 'border-brand/40 text-white'
                      : 'border-white/10 text-white/45'
                  }`}
                >
                  <option value="">— не задано —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {preview.sample.length > 0 && (
            <div className="overflow-x-auto border-t border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wide text-white/35">
                  <tr className="border-b border-white/10">
                    {headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {preview.sample.slice(0, 8).map((row, i) => (
                    <tr key={i} className="hover:bg-white/[0.03]">
                      {headers.map((h) => (
                        <td
                          key={h}
                          className="max-w-[180px] truncate px-3 py-2 text-white/70"
                        >
                          {String(row[h] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {result && (
        <Panel className="p-5">
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 size={18} />
            <h3 className="font-semibold text-white">Импорт завершён</h3>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              icon={<Database size={15} />}
              label="Загружено"
              value={fmtNum(result.ingested)}
              accent="text-white"
            />
            <Stat
              icon={<AlertTriangle size={15} />}
              label="Алертов"
              value={fmtNum(result.alerts)}
              accent="text-amber-300"
            />
            <Stat
              icon={<AlertTriangle size={15} />}
              label="Инцидентов"
              value={fmtNum(result.incidents)}
              accent="text-red-400"
            />
            <Stat
              icon={<Activity size={15} />}
              label="Throughput"
              value={`${fmtNum(result.throughput_eps)} ev/s`}
              accent="text-brand"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/45">
            <span>Время: {result.elapsed_sec}s</span>
            <span>Сработало детекторов: {fmtNum(result.flagged_events)}</span>
            <span>В памяти (хвост): {fmtNum(result.raw_retained)}</span>
            {result.aggregates?.total_amount > 0 && (
              <span>
                Сумма транзакций:{' '}
                {fmtNum(result.aggregates.total_amount)}
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <AggList
              title="По классам событий"
              rows={Object.entries(result.aggregates?.by_class || {})}
            />
            <AggList
              title={fmt === 'syslog' ? 'Топ атакующих IP' : 'Топ отправителей'}
              rows={result.aggregates?.top_actors || []}
            />
            <AggList
              title={fmt === 'syslog' ? 'Топ атакуемых пользователей' : 'Топ получателей'}
              rows={result.aggregates?.top_targets || []}
            />
          </div>
        </Panel>
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-white/40">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  )
}

function AggList({
  title,
  rows,
}: {
  title: string
  rows: [string, number][] | string[][]
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-white/40">
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-white/30">—</div>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 8).map(([k, v]) => (
            <li
              key={String(k)}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate text-white/70">{String(k)}</span>
              <span className="tabular-nums text-white/45">
                {new Intl.NumberFormat('ru-RU').format(Number(v))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
