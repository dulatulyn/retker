import { Container } from './ui'
import { useT } from '../lib/i18n'

const stats: [string, string][] = [
  ['home.stats.0.value', 'home.stats.0.label'],
  ['home.stats.1.value', 'home.stats.1.label'],
  ['home.stats.2.value', 'home.stats.2.label'],
  ['home.stats.3.value', 'home.stats.3.label'],
]

export function StatBand() {
  const t = useT()
  return (
    <section className="py-20">
      <Container>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([n, l]) => (
            <div key={l} className="bg-surface p-8 text-center">
              <div className="text-4xl font-medium tracking-tight text-white sm:text-5xl">
                {t(n)}
              </div>
              <div className="mt-2 text-sm text-white/55">{t(l)}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
