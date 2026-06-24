import {
  Fingerprint,
  Activity,
  FileSearch,
  Mail,
  Bot,
  Search,
  ShieldCheck,
  Database,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Container, Eyebrow } from './ui'
import { useT } from '../lib/i18n'

export function BentoFeatures() {
  const t = useT()
  return (
    <section className="py-24">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>{t('features.bento.eyebrow')}</Eyebrow>
          <h2 className="mt-3 text-4xl text-white sm:text-5xl">
            {t('features.bento.title')}
          </h2>
          <p className="mt-4 text-white/55">
            {t('features.bento.desc')}
          </p>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Bot}
            title={t('features.bento.ai.title')}
            desc={t('features.bento.ai.desc')}
            className="sm:col-span-2"
          >
            <Panel className="space-y-2.5">
              <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-xs font-medium text-white">
                {t('features.bento.ai.question')}
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                  <Bot size={13} />
                </span>
                <div className="rounded-2xl rounded-bl-md bg-white/[0.04] px-3.5 py-2 text-xs leading-relaxed text-white/70 ring-1 ring-inset ring-white/10">
                  {t('features.bento.ai.answer')}{' '}
                  <span className="font-medium text-brand">{t('features.bento.ai.risk')}</span>.
                </div>
              </div>
            </Panel>
          </FeatureCard>

          <FeatureCard
            icon={Fingerprint}
            title={t('features.bento.access.title')}
            desc={t('features.bento.access.desc')}
          >
            <Panel>
              <svg viewBox="0 0 240 56" className="w-full">
                <path d="M20 42 Q120 2 220 32" fill="none" stroke="#0099ff" strokeWidth="1.5" strokeDasharray="3 4" />
                <circle cx="20" cy="42" r="3.5" fill="#fff" />
                <circle cx="220" cy="32" r="3.5" fill="#0099ff" />
              </svg>
              <div className="mt-1 flex justify-between font-mono text-[13px] text-white/40">
                <span>{t('features.bento.access.from')}</span>
                <span>{t('features.bento.access.to')}</span>
              </div>
            </Panel>
          </FeatureCard>

          <FeatureCard icon={Activity} title={t('features.bento.anomaly.title')} desc={t('features.bento.anomaly.desc')}>
            <Panel>
              <div className="flex h-12 items-end gap-1.5">
                {[20, 32, 16, 26, 22, 34, 100, 24, 20].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}%`,
                      backgroundColor: h > 60 ? '#0099ff' : 'rgba(255,255,255,0.18)',
                    }}
                  />
                ))}
              </div>
            </Panel>
          </FeatureCard>

          <FeatureCard icon={FileSearch} title={t('features.bento.dlp.title')} desc={t('features.bento.dlp.desc')}>
            <Panel className="flex flex-wrap gap-2">
              {[t('features.bento.dlp.iin'), t('features.bento.dlp.card')].map((c) => (
                <span
                  key={c}
                  className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[13px] text-white/60 ring-1 ring-inset ring-white/10"
                >
                  {c}
                </span>
              ))}
            </Panel>
          </FeatureCard>

          <FeatureCard icon={Mail} title={t('features.bento.phishing.title')} desc={t('features.bento.phishing.desc')}>
            <Panel className="font-mono text-xs">
              <span className="text-white/50">kaspi-bonus.</span>
              <span className="text-brand">xn--80a.tk</span>
            </Panel>
          </FeatureCard>

          <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface p-6 transition-colors duration-300 hover:border-white/20 sm:col-span-2 lg:col-span-3">
            <CardEdge />
            <div className="grid items-center gap-6 lg:grid-cols-2">
              <div>
                <div className="flex items-center gap-3">
                  <IconChip icon={Search} />
                  <h3 className="text-[18px] font-semibold text-white">{t('features.bento.nl.title')}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  {t('features.bento.nl.desc')}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm">
                  <Search size={15} className="shrink-0 text-white/40" />
                  <span className="text-white/80">{t('features.bento.nl.placeholder')}</span>
                  <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-brand" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[t('features.bento.nl.q1'), t('features.bento.nl.q2'), t('features.bento.nl.q3')].map((q) => (
                    <span key={q} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/55">
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

function IconChip({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
      <Icon size={17} />
    </span>
  )
}

function CardEdge() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-auto rounded-xl border border-white/10 bg-black/20 p-3.5 ${className}`}>
      {children}
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  desc,
  className = '',
  children,
}: {
  icon: LucideIcon
  title: string
  desc: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface p-6 transition-colors duration-300 hover:border-white/20 ${className}`}
    >
      <CardEdge />
      <div className="flex items-center gap-3">
        <IconChip icon={icon} />
        <h3 className="text-[18px] font-semibold text-white">{title}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{desc}</p>
      {children}
    </div>
  )
}

const rows = [
  {
    icon: Database,
    titleKey: 'features.altsplit.stream.title',
    descKey: 'features.altsplit.stream.desc',
  },
  {
    icon: ShieldCheck,
    titleKey: 'features.altsplit.react.title',
    descKey: 'features.altsplit.react.desc',
  },
]
export function AltSplit() {
  const t = useT()
  return (
    <section className="py-12">
      <Container className="space-y-16">
        {rows.map(({ icon: Icon, titleKey, descKey }, i) => (
          <div key={titleKey} className="grid items-center gap-10 md:grid-cols-2">
            <div className={i % 2 ? 'md:order-2' : ''}>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/15 text-brand">
                <Icon size={18} />
              </span>
              <h3 className="mt-5 text-2xl text-white sm:text-3xl">{t(titleKey)}</h3>
              <p className="mt-4 text-white/55">{t(descKey)}</p>
            </div>
            <div className={`relative h-56 overflow-hidden rounded-2xl border border-white/10 bg-surface ${i % 2 ? 'md:order-1' : ''}`}>
              <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 glow-blue opacity-40" />
              <div className="absolute inset-0 grid place-items-center text-white/15">
                <Icon size={72} />
              </div>
            </div>
          </div>
        ))}
      </Container>
    </section>
  )
}

export function SurfaceCards() {
  const t = useT()
  return (
    <section className="py-24">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>{t('features.surface.eyebrow')}</Eyebrow>
          <h2 className="mt-3 text-4xl text-white sm:text-5xl">{t('features.surface.title')}</h2>
          <p className="mt-4 text-white/55">
            {t('features.surface.desc')}
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ['bg-surface', 'features.surface.collect.title', 'features.surface.collect.desc'],
            ['bg-surface-2', 'features.surface.analyze.title', 'features.surface.analyze.desc'],
            ['bg-surface-3', 'features.surface.react.title', 'features.surface.react.desc'],
          ].map(([bg, titleKey, descKey]) => (
            <div key={titleKey} className={`rounded-2xl border border-white/10 p-6 ${bg}`}>
              <h3 className="text-lg font-semibold text-white">{t(titleKey)}</h3>
              <p className="mt-2 text-sm text-white/55">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
