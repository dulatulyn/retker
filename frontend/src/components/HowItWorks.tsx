import { Database, Bot, ShieldCheck } from 'lucide-react'
import { Container, Eyebrow } from './ui'
import { Reveal } from './Reveal'
import { useT } from '../lib/i18n'

const steps = [
  {
    n: '01',
    icon: Database,
    titleKey: 'features.how.step1.title',
    descKey: 'features.how.step1.desc',
  },
  {
    n: '02',
    icon: Bot,
    titleKey: 'features.how.step2.title',
    descKey: 'features.how.step2.desc',
  },
  {
    n: '03',
    icon: ShieldCheck,
    titleKey: 'features.how.step3.title',
    descKey: 'features.how.step3.desc',
  },
]

export function HowItWorks() {
  const t = useT()
  return (
    <section className="py-24">
      <Container>
        <Reveal>
          <div className="max-w-2xl">
            <Eyebrow>{t('features.how.eyebrow')}</Eyebrow>
            <h2 className="mt-3 text-4xl text-white sm:text-5xl">
              {t('features.how.title')}
            </h2>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => {
            const Icon = s.icon
            return (
              <Reveal key={s.n} delay={i * 90}>
                <div className="h-full rounded-2xl border border-white/10 bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/15 text-brand">
                      <Icon size={18} />
                    </span>
                    <span className="text-sm text-white/25">{s.n}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">{t(s.titleKey)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{t(s.descKey)}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
