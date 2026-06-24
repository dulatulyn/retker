import { useEffect, useRef, useState } from 'react'
import { Bot, CornerDownLeft, Wrench } from 'lucide-react'
import { Container, Eyebrow } from './ui'
import { api } from '../lib/api'
import { useT } from '../lib/i18n'

const TOOL_KEYS = new Set([
  'get_stats',
  'search_logs',
  'list_incidents',
  'get_incident',
  'get_alerts',
  'search_knowledge',
  'score_transaction',
  'score_event',
])

// Keyword groups map the user query to a fallback answer key (playground.console.fallback.<i>).
const FALLBACK_KEYWORDS: string[][] = [
  ['вход', 'стран', 'сеул', 'ноч', 'impossible', 'travel', 'логин', 'геогра'],
  ['скач', 'выгру', 'базу', 'базы', 'клиент', 'экспорт', 'аномал', 'ueba'],
  ['утечк', 'иин', 'данны', 'dlp', 'карт', 'персональн', 'секрет'],
  ['домен', 'фишинг', 'kaspi', 'ссылк', 'письм', 'phish', 'punycode', 'xn--'],
]

const EXAMPLE_KEYS = [
  'playground.console.example.0',
  'playground.console.example.1',
  'playground.console.example.2',
  'playground.console.example.3',
]

type Turn = { q: string; a: string; tools: string[]; thinking: boolean; done: boolean }

export function LiveConsole() {
  const t = useT()
  const toolLabel = (tool: string) =>
    TOOL_KEYS.has(tool) ? t(`playground.console.tool.${tool}`) : tool
  const fallbackFor = (query: string): string => {
    const q = query.toLowerCase()
    const i = FALLBACK_KEYWORDS.findIndex((kws) => kws.some((k) => q.includes(k)))
    return i >= 0 ? t(`playground.console.fallback.${i}`) : t('playground.console.fallback.generic')
  }

  const [turns, setTurns] = useState<Turn[]>([
    {
      q: t('playground.console.example.0'),
      a: t('playground.console.fallback.0'),
      tools: [t('playground.console.tool.search_logs')],
      thinking: false,
      done: true,
    },
  ])
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }, [turns])
  useEffect(() => () => wsRef.current?.close(), [])

  const patchLast = (fn: (t: Turn) => Turn) =>
    setTurns((ts) => { const c = ts.slice(); c[c.length - 1] = fn(c[c.length - 1]); return c })

  async function run(query: string) {
    const q = query.trim()
    if (!q || busy) return
    setValue('')
    setBusy(true)
    setTurns((t) => [...t, { q, a: '', tools: [], thinking: true, done: false }])

    let finished = false
    let gotText = false
    const finish = () => { if (!finished) { finished = true; patchLast((t) => ({ ...t, done: true, thinking: false })); setBusy(false) } }
    const fallback = () => {
      if (finished) return
      finished = true
      patchLast((t) => ({ ...t, a: fallbackFor(q), thinking: false, done: true }))
      setBusy(false)
    }

    try {
      if (!tokenRef.current) tokenRef.current = (await api.demoToken()).token
    } catch { return fallback() }

    let ws: WebSocket
    try { ws = new WebSocket(api.chatWsUrlWith(tokenRef.current!)) } catch { return fallback() }
    wsRef.current = ws
    ws.onopen = () => ws.send(JSON.stringify({ message: q, chat_id: null }))
    ws.onmessage = (e) => {
      let d: any
      try { d = JSON.parse(e.data) } catch { return }
      if (d.type === 'tool') patchLast((t) => ({ ...t, tools: [...t.tools, toolLabel(d.tool)] }))
      else if (d.type === 'delta') { gotText = true; patchLast((t) => ({ ...t, a: t.a + d.text, thinking: false })) }
      else if (d.type === 'done') { finish(); ws.close() }
      else if (d.type === 'error') { fallback(); ws.close() }
    }
    ws.onclose = () => { if (!finished) (gotText ? finish() : fallback()) }
    ws.onerror = () => {  }
  }

  return (
    <section className="py-24">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>{t('playground.console.eyebrow')}</Eyebrow>
          <h2 className="mt-3 text-4xl text-white sm:text-5xl">{t('playground.console.heading')}</h2>
          <p className="mt-4 text-white/55">{t('playground.console.lead')}</p>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl shadow-black/50 ring-1 ring-white/5">
          <div className="flex items-center gap-2.5 border-b border-white/10 bg-black/40 px-4 py-3.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            <span className="ml-2 font-mono text-xs text-white/45">{t('playground.console.title')}</span>
            <span className="ml-auto flex items-center gap-1.5 text-[13px] text-white/45">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> live demo
            </span>
          </div>

          <div ref={scrollRef} className="max-h-[420px] min-h-[260px] space-y-6 overflow-y-auto p-5 font-mono text-sm">
            {turns.map((t, i) => (
              <div key={i}>
                <div className="flex gap-2 text-white/85">
                  <span className="select-none text-brand">{'>'}</span>
                  <span>{t.q}</span>
                </div>
                <div className="mt-2.5 flex gap-2.5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                    <Bot size={13} />
                  </span>
                  <div className="min-w-0 flex-1 leading-relaxed text-white/70">
                    {t.tools.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {t.tools.map((s, n) => (
                          <span key={n} className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-0.5 text-[11px] text-brand/90">
                            <Wrench size={10} /> {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {t.thinking && !t.a ? (
                      <TypingDots />
                    ) : (
                      <>
                        <span className="whitespace-pre-wrap">{t.a}</span>
                        {!t.done && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-brand align-middle" />}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {EXAMPLE_KEYS.map((k) => {
                const q = t(k)
                return (
                  <button key={k} type="button" disabled={busy} onClick={() => run(q)}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/55 transition-colors hover:border-white/20 hover:text-white disabled:opacity-40">
                    {q}
                  </button>
                )
              })}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); run(value) }}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 font-mono text-sm focus-within:border-white/25">
              <span className="select-none text-brand">{'>'}</span>
              <input value={value} onChange={(e) => setValue(e.target.value)}
                placeholder={t('playground.console.placeholder')}
                className="min-w-0 flex-1 bg-transparent text-white/85 placeholder:text-white/30 focus:outline-none" />
              <button type="submit" disabled={busy || !value.trim()}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand text-white transition-opacity disabled:opacity-30"
                aria-label={t('playground.console.send')}>
                <CornerDownLeft size={15} />
              </button>
            </form>
          </div>
        </div>
      </Container>
    </section>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  )
}
