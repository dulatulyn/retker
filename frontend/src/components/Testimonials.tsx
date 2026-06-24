import { Container, Eyebrow } from './ui'
import { useT } from '../lib/i18n'

const quotes = [
  {
    textKey: 'features.testimonials.q1.text',
    nameKey: 'features.testimonials.q1.name',
    roleKey: 'features.testimonials.q1.role',
  },
  {
    textKey: 'features.testimonials.q2.text',
    nameKey: 'features.testimonials.q2.name',
    roleKey: 'features.testimonials.q2.role',
  },
  {
    textKey: 'features.testimonials.q3.text',
    nameKey: 'features.testimonials.q3.name',
    roleKey: 'features.testimonials.q3.role',
  },
]

export function Testimonials() {
  const t = useT()
  return (
    <section className="py-24">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>{t('features.testimonials.eyebrow')}</Eyebrow>
          <h2 className="mt-3 text-4xl text-white sm:text-5xl">
            {t('features.testimonials.title')}
          </h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {quotes.map((q) => (
            <figure
              key={q.nameKey}
              className="flex flex-col rounded-2xl border border-white/10 bg-surface p-6"
            >
              <blockquote className="text-[18px] leading-relaxed text-white/80">
                «{t(q.textKey)}»
              </blockquote>
              <figcaption className="mt-6 border-t border-white/10 pt-4">
                <div className="text-sm font-semibold text-white">{t(q.nameKey)}</div>
                <div className="text-sm text-white/45">{t(q.roleKey)}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  )
}
