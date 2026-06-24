import { useEffect, useRef, useState } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-python'
import { Play, ArrowUpRight } from 'lucide-react'
import { Container, Eyebrow } from './ui'
import { Reveal } from './Reveal'
import { useT } from '../lib/i18n'

const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }

function hl(code: string, lang: string) {
  const grammar = Prism.languages[lang] || Prism.languages.clike
  return Prism.highlight(code, grammar, lang)
}

const REQ_TABS = [
  {
    label: 'cURL',
    lang: 'bash',
    code: `curl -X POST https://api.retker.kz/v1/ingest \\
  -H "Authorization: Bearer $RETKER_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ts": "2026-06-24T02:13:41Z",
    "event_class": "authentication",
    "action": "login_success",
    "actor": { "user": "u.berik", "ip": "175.223.10.4", "country": "KR" }
  }'`,
  },
  {
    label: 'Node.js',
    lang: 'javascript',
    code: `await fetch("https://api.retker.kz/v1/ingest", {
  method: "POST",
  headers: { Authorization: \`Bearer \${TOKEN}\` },
  body: JSON.stringify({
    ts: "2026-06-24T02:13:41Z",
    event_class: "authentication",
    action: "login_success",
    actor: { user: "u.berik", ip: "175.223.10.4", country: "KR" },
  }),
})`,
  },
  {
    label: 'Python',
    lang: 'python',
    code: `requests.post(
    "https://api.retker.kz/v1/ingest",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={
        "ts": "2026-06-24T02:13:41Z",
        "event_class": "authentication",
        "action": "login_success",
        "actor": {"user": "u.berik", "ip": "175.223.10.4", "country": "KR"},
    },
)`,
  },
]

const RESPONSE = `{
  "event_id": "evt_8f21",
  "received": true,
  "risk": { "score": 87, "level": "высокий" },
  "incident": "inc_4a90",
  "detector": "impossible_travel",
  "explanation": "Вход из KR через 1 мин после KZ, невозможная скорость."
}`

function Spinner({ big = false }: { big?: boolean }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-white/20 border-t-brand ${
        big ? 'h-6 w-6' : 'h-3.5 w-3.5'
      }`}
    />
  )
}

export function ApiPlayground() {
  const t = useT()
  const [tab, setTab] = useState(0)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function send() {
    if (status === 'loading') return
    setStatus('loading')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus('done'), 750)
  }

  function copy() {
    navigator.clipboard?.writeText(REQ_TABS[tab].code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const active = REQ_TABS[tab]

  return (
    <section className="py-24">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>{t('playground.api.eyebrow')}</Eyebrow>
          <h2 className="mt-3 text-4xl text-white sm:text-5xl">{t('playground.api.heading')}</h2>
          <p className="mt-4 text-white/55">{t('playground.api.lead')}</p>
        </div>

        <div className="mt-10 grid items-stretch gap-3 lg:grid-cols-5">
          <div className="flex min-h-[440px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0e] shadow-2xl shadow-black/50 ring-1 ring-white/5 lg:col-span-3">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-semibold text-sky-400">
                POST
              </span>
              <span className="text-[16px] text-white/70" style={MONO}>
                /v1/ingest
              </span>
              <button
                onClick={send}
                disabled={status === 'loading'}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Play size={13} /> {t('playground.api.send')}
              </button>
            </div>
            <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
              {REQ_TABS.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => setTab(i)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    i === tab ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={copy}
                className="ml-auto pr-1 text-xs text-white/35 transition-colors hover:text-white/60"
              >
                {copied ? t('playground.api.copied') : t('playground.api.copy')}
              </button>
            </div>
            <pre
              className="prism flex-1 overflow-x-auto px-4 py-3.5 text-[16px] leading-relaxed"
              style={MONO}
            >
              <code dangerouslySetInnerHTML={{ __html: hl(active.code, active.lang) }} />
            </pre>
          </div>

          <div className="flex min-h-[440px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0e] shadow-2xl shadow-black/50 ring-1 ring-white/5 lg:col-span-2">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
              <span className="text-[16px] text-white/70" style={MONO}>
                {t('playground.api.response')}
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs">
                {status === 'idle' && <span className="text-white/30">{t('playground.api.status.idle')}</span>}
                {status === 'loading' && (
                  <>
                    <Spinner /> <span className="text-white/50">{t('playground.api.status.loading')}</span>
                  </>
                )}
                {status === 'done' && (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-emerald-400">200 OK</span>
                    <span className="text-white/30">· 142 ms</span>
                  </>
                )}
              </span>
            </div>
            <div className="flex-1">
              {status === 'done' ? (
                <Reveal y={6} blur={8}>
                  <pre
                    className="prism overflow-x-auto px-4 py-3.5 text-[16px] leading-relaxed"
                    style={MONO}
                  >
                    <code dangerouslySetInnerHTML={{ __html: hl(RESPONSE, 'json') }} />
                  </pre>
                </Reveal>
              ) : (
                <div className="grid h-full place-items-center p-8 text-center">
                  {status === 'loading' ? (
                    <Spinner big />
                  ) : (
                    <p className="max-w-[16rem] text-xs leading-relaxed text-white/30" style={MONO}>
                      {t('playground.api.empty')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <a
          href="/docs"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-opacity hover:opacity-80"
        >
          {t('playground.api.docsLink')} <ArrowUpRight size={15} />
        </a>
      </Container>
    </section>
  )
}
