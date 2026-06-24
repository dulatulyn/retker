import { useState } from 'react'
import { Search, ArrowUpRight } from 'lucide-react'
import Prism from 'prismjs'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-python'
import { Logo } from '../components/Logo'
import { useT } from '../lib/i18n'

const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }

function highlight(code: string, lang: string) {
  const grammar = Prism.languages[lang] || Prism.languages.clike
  return Prism.highlight(code, grammar, lang)
}

function Pre({ code, lang }: { code: string; lang: string }) {
  return (
    <pre
      className="prism overflow-x-auto px-4 py-3.5 text-[16px] leading-relaxed"
      style={MONO}
    >
      <code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} />
    </pre>
  )
}

function Code({ title, lang, code }: { title: string; lang: string; code: string }) {
  const t = useT()
  return (
    <div className="my-5 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/40">
        <span>{title}</span>
        <span className="cursor-pointer hover:text-white/70">{t('docs.copy')}</span>
      </div>
      <Pre code={code} lang={lang} />
    </div>
  )
}

function CodeTabs({ tabs }: { tabs: { label: string; lang: string; code: string }[] }) {
  const t = useT()
  const [i, setI] = useState(0)
  return (
    <div className="my-5 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
      <div className="flex items-center gap-1 border-b border-white/10 px-2 py-1.5">
        {tabs.map((t, idx) => (
          <button
            key={t.label}
            onClick={() => setI(idx)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              i === idx ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto pr-2 text-xs text-white/35 cursor-pointer hover:text-white/60">
          {t('docs.copy')}
        </span>
      </div>
      <Pre code={tabs[i].code} lang={tabs[i].lang} />
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-white/10 py-10 first:border-0 first:pt-0">
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-[18px] leading-relaxed text-white/65">{children}</div>
    </section>
  )
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/10 px-1.5 py-0.5 text-[16px] text-white/80" style={MONO}>
      {children}
    </code>
  )
}

const toc: [string, string][] = [
  ['intro', 'docs.nav.intro'],
  ['quickstart', 'docs.nav.quickstart'],
  ['ingest', 'docs.nav.ingest'],
  ['schema', 'docs.nav.schema'],
  ['detectors', 'docs.nav.detectors'],
  ['ai', 'docs.nav.ai'],
  ['nl', 'docs.nav.nl'],
  ['api', 'docs.nav.api'],
]

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const ingestTabs = [
  {
    label: 'cURL',
    lang: 'bash',
    code: `curl -X POST https://api.retker.kz/v1/events/access \\
  -H "X-Org-Key: demo-key-123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ts": "2026-06-24T02:47:00Z",
    "user": "a.serik",
    "ip": "175.223.10.4",
    "country": "KR",
    "success": true
  }'`,
  },
  {
    label: 'Python',
    lang: 'python',
    code: `import requests

requests.post(
    "https://api.retker.kz/v1/events/access",
    headers={"X-Org-Key": "demo-key-123"},
    json={
        "ts": "2026-06-24T02:47:00Z",
        "user": "a.serik",
        "ip": "175.223.10.4",
        "country": "KR",
        "success": True,
    },
)`,
  },
  {
    label: 'Node.js',
    lang: 'javascript',
    code: `await fetch("https://api.retker.kz/v1/events/access", {
  method: "POST",
  headers: {
    "X-Org-Key": "demo-key-123",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    ts: "2026-06-24T02:47:00Z",
    user: "a.serik",
    ip: "175.223.10.4",
    country: "KR",
    success: true,
  }),
})`,
  },
]

const ingestResponse = `{
  "event_id": "evt_8f21",
  "risk": { "score": 0.93, "severity": 5, "detectors": ["impossible_travel"] },
  "incident_id": "inc_4a90",
  "alerts": ["al_12ab"]
}`

const ingestDoors = [
  {
    name: 'Ingest Access',
    path: '/v1/events/access',
    body: `{
  "ts": "2026-06-24T02:47:00Z",
  "user": "a.serik",
  "ip": "175.223.10.4",
  "country": "KR",
  "success": true
}`,
  },
  {
    name: 'Ingest Transaction',
    path: '/v1/events/transaction',
    body: `{
  "from": "C1305486145",
  "to": "C553264065",
  "amount": 181000,
  "type": "cash_out"
}`,
  },
  {
    name: 'Ingest Data',
    path: '/v1/events/data',
    body: `{
  "user": "u.berik",
  "resource": "db.clients",
  "action": "export",
  "rows": 10480,
  "content": "ИИН 901224300945, карта 4400 4302 3209 8821"
}`,
  },
  {
    name: 'Ingest Email',
    path: '/v1/events/email',
    body: `{
  "from": "no-reply@kaspi-bonus.xn--80a.tk",
  "to": "user@bank.kz",
  "subject": "Ваш бонус активирован",
  "links": ["http://kaspi-bonus.xn--80a.tk/login"]
}`,
  },
]

const schemaCode = `{
  "event_id": "evt_8f21",
  "org_id": "org_a1b2",
  "ts": "2026-06-24T02:14:07Z",
  "event_class": "data_activity",
  "action": "bulk_export",
  "actor":  { "user": "u.berik", "ip": "10.2.4.51", "country": "KZ" },
  "target": { "resource": "db.clients", "host": "srv-db-01" },
  "metrics": { "rows": 10480, "bytes": 5242880 },
  "risk":   { "score": 0.93, "severity": 5, "detectors": ["ueba", "dlp_iin"] }
}`

const chatRequest = `{ "message": "Насколько рискованна транзакция evt_tx7?" }`

const chatResponse = `{
  "reply": "Транзакция evt_tx7 — очень высокий риск (скор 0.9999): обналичивание, крупная сумма.",
  "trace": [{ "tool": "score_event", "args": { "event_id": "evt_tx7" } }],
  "online": true,
  "provider": "gemini",
  "suggestions": ["Кто инициатор операций?", "Покажи открытые инциденты"]
}`

const methodStyle: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400',
  POST: 'bg-sky-500/15 text-sky-400',
  PUT: 'bg-amber-500/15 text-amber-300',
  DELETE: 'bg-red-500/15 text-red-400',
}

const endpoints: [string, string, string][] = [
  ['POST', '/v1/auth/login', 'docs.endpoint.login'],
  ['POST', '/v1/events/access', 'docs.endpoint.access'],
  ['POST', '/v1/events/transaction', 'docs.endpoint.transaction'],
  ['POST', '/v1/events/data', 'docs.endpoint.data'],
  ['POST', '/v1/events/email', 'docs.endpoint.email'],
  ['GET', '/v1/overview', 'docs.endpoint.overview'],
  ['GET', '/v1/incidents', 'docs.endpoint.incidents'],
  ['GET', '/v1/incidents/:id', 'docs.endpoint.incidentDetails'],
  ['POST', '/v1/incidents/:id/block', 'docs.endpoint.block'],
  ['POST', '/v1/query', 'docs.endpoint.query'],
  ['POST', '/v1/chat', 'docs.endpoint.chat'],
  ['GET', '/v1/reports/:id', 'docs.endpoint.report'],
  ['GET', '/v1/timeseries', 'docs.endpoint.timeseries'],
  ['GET', '/v1/stream', 'docs.endpoint.stream'],
]

export function Docs() {
  const t = useT()
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2">
            <Logo className="h-6 w-6 text-white" />
            <span className="text-[18px] font-semibold tracking-tight">retker</span>
            <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-white/50">
              docs
            </span>
          </a>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/40 sm:flex">
              <Search size={14} /> {t('docs.search.placeholder')}
            </div>
            <a
              href="/app"
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15"
            >
              {t('docs.openProduct')} <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-12 px-6">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-56 shrink-0 py-10 lg:block">
          <p className="px-3 text-xs uppercase tracking-wide text-white/35">{t('docs.sidebar.title')}</p>
          <nav className="mt-3 space-y-0.5">
            {toc.map(([id, label]) => (
              <button
                key={id}
                onClick={() => go(id)}
                className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-white/55 transition-colors hover:bg-white/5 hover:text-white"
              >
                {t(label)}
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 max-w-3xl flex-1 py-12">
          <p className="text-sm font-medium text-brand">retker · v0.1</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">{t('docs.title')}</h1>
          <p className="mt-4 text-lg text-white/55">{t('docs.lead')}</p>

          <div className="mt-10">
            <Section id="intro" title={t('docs.section.intro.title')}>
              <p>{t('docs.section.intro.p1')}</p>
              <p>{t('docs.section.intro.p2')}</p>
            </Section>

            <Section id="quickstart" title={t('docs.section.quickstart.title')}>
              <p>
                {t('docs.section.quickstart.p1.before')}<InlineCode>X-Org-Key</InlineCode>
                {t('docs.section.quickstart.p1.demo')}<InlineCode>demo-key-123</InlineCode>
                {t('docs.section.quickstart.p1.after')}
              </p>
              <CodeTabs tabs={ingestTabs} />
              <p>{t('docs.section.quickstart.p2')}</p>
              <Code title={t('docs.code.ingestResponse.title')} lang="json" code={ingestResponse} />
            </Section>

            <Section id="ingest" title={t('docs.section.ingest.title')}>
              <p>
                {t('docs.section.ingest.p1.before')}<InlineCode>CanonicalEvent</InlineCode>
                {t('docs.section.ingest.p1.middle')}
                <InlineCode>X-Org-Key</InlineCode>
                {t('docs.section.ingest.p1.after')}
              </p>
              {ingestDoors.map((d) => (
                <div key={d.path} className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0e]">
                  <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-xs font-semibold text-sky-400">
                      POST
                    </span>
                    <span className="text-[15px] text-white/80" style={MONO}>{d.path}</span>
                    <span className="ml-auto text-sm text-white/45">{d.name}</span>
                  </div>
                  <Pre code={d.body} lang="json" />
                </div>
              ))}
            </Section>

            <Section id="schema" title={t('docs.section.schema.title')}>
              <p>{t('docs.section.schema.p1')}</p>
              <Code title={t('docs.code.schema.title')} lang="json" code={schemaCode} />
            </Section>

            <Section id="detectors" title={t('docs.section.detectors.title')}>
              <p>{t('docs.section.detectors.p1')}</p>
              <ul className="list-disc space-y-1.5 pl-5 text-white/70">
                <li>{t('docs.section.detectors.item1')}</li>
                <li>{t('docs.section.detectors.item2')}</li>
                <li>{t('docs.section.detectors.item3')}</li>
                <li>{t('docs.section.detectors.item4')}</li>
              </ul>
            </Section>

            <Section id="ai" title={t('docs.section.ai.title')}>
              <p>
                {t('docs.section.ai.p1.before')}
                <InlineCode>unified_threat</InlineCode>{t('docs.section.ai.p1.after')}
              </p>
              <p>
                {t('docs.section.ai.p2.before')}<InlineCode>score_event</InlineCode>
                {t('docs.section.ai.p2.middle')}<InlineCode>trace</InlineCode>
                {t('docs.section.ai.p2.after')}
              </p>
              <Code title={t('docs.code.chatRequest.title')} lang="json" code={chatRequest} />
              <Code title={t('docs.code.chatResponse.title')} lang="json" code={chatResponse} />
            </Section>

            <Section id="nl" title={t('docs.section.nl.title')}>
              <p>{t('docs.section.nl.p1')}</p>
              <Code
                title={t('docs.code.nlQuery.title')}
                lang="json"
                code={`{ "q": "покажи входы из новых стран ночью за последние сутки" }`}
              />
              <p>{t('docs.section.nl.p2')}</p>
            </Section>

            <Section id="api" title={t('docs.section.api.title')}>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-white/35">
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 font-medium">{t('docs.table.method')}</th>
                      <th className="px-4 py-3 font-medium">{t('docs.table.path')}</th>
                      <th className="px-4 py-3 font-medium">{t('docs.table.desc')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {endpoints.map(([m, path, desc]) => (
                      <tr key={path}>
                        <td className="px-4 py-3">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${methodStyle[m]}`}>
                            {m}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/80" style={MONO}>
                          {path}
                        </td>
                        <td className="px-4 py-3 text-white/55">{t(desc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </main>
      </div>
    </div>
  )
}
