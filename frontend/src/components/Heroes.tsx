import { ArrowRight, Bot, ShieldCheck } from 'lucide-react'
import { Container, Button, Badge } from './ui'
import { useT } from '../lib/i18n'

export function HeroCentered() {
  const t = useT()
  return (
    <section className="relative overflow-hidden">
      <Container className="relative py-28 sm:py-36">
        <h1 className="max-w-3xl text-5xl text-white sm:text-7xl">
          {t('home.heroCentered.title')}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/55">
          {t('home.heroCentered.subtitle')}
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button href="/app">
            {t('home.heroCentered.runDemo')} <ArrowRight size={16} />
          </Button>
          <Button variant="secondary" href="/docs">
            {t('home.heroCentered.docs')}
          </Button>
        </div>
      </Container>
    </section>
  )
}

export function HeroSplit() {
  const t = useT()
  return (
    <section className="relative overflow-hidden border-t border-white/10">
      <Container className="grid items-center gap-12 py-24 md:grid-cols-2">
        <div>
          <Badge>{t('home.heroSplit.badge')}</Badge>
          <h1 className="mt-5 text-4xl text-white sm:text-6xl">
            {t('home.heroSplit.title')}
          </h1>
          <p className="mt-5 text-lg text-white/55">
            {t('home.heroSplit.subtitle')}
          </p>
          <div className="mt-7 flex gap-3">
            <Button>{t('home.heroSplit.start')}</Button>
            <Button variant="ghost">{t('home.heroSplit.howItWorks')}</Button>
          </div>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute -inset-8 glow-blue opacity-40" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface">
            <div className="flex items-center justify-between border-b border-white/10 bg-surface-2 px-4 py-3 text-xs">
              <span className="text-white/80">{t('home.heroSplit.incident')}</span>
              <span className="rounded bg-red-500/15 px-2 py-0.5 font-semibold text-red-400">
                {t('home.heroSplit.critical')}
              </span>
            </div>
            <div className="space-y-3 p-4">
              {[
                ['home.heroSplit.event1Time', 'home.heroSplit.event1Label'],
                ['home.heroSplit.event2Time', 'home.heroSplit.event2Label'],
              ].map(([timeKey, labelKey]) => (
                <div key={timeKey} className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-white/40">{t(timeKey)}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  <span className="text-white/85">{t(labelKey)}</span>
                </div>
              ))}
              <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-brand">
                  <Bot size={14} /> {t('home.heroSplit.aiAnalyst')}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/55">
                  {t('home.heroSplit.aiText')}
                </p>
              </div>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2 text-sm font-semibold text-black">
                <ShieldCheck size={15} /> {t('home.heroSplit.block')}
              </button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
