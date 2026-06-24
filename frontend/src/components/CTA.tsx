import { ArrowRight } from 'lucide-react'
import { Container, Button } from './ui'
import { useT } from '../lib/i18n'

export function CTA() {
  const t = useT()
  return (
    <section className="relative overflow-hidden py-28">
      <div className="pointer-events-none absolute bottom-[-30%] left-1/2 h-[420px] w-[720px] -translate-x-1/2 glow-blue opacity-70" />
      <Container className="relative text-center">
        <h2 className="mx-auto max-w-2xl text-4xl text-white sm:text-6xl">
          {t('home.cta.title')}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/55">
          {t('home.cta.subtitle')}
        </p>
        <div className="mt-9 flex items-center justify-center gap-3">
          <Button size="lg">
            {t('home.cta.runDemo')} <ArrowRight size={16} />
          </Button>
          <Button variant="secondary" size="lg">
            {t('home.cta.contact')}
          </Button>
        </div>
      </Container>
    </section>
  )
}
