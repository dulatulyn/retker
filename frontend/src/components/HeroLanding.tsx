import { ArrowRight } from 'lucide-react'
import { Container, Button, Badge } from './ui'
import { Reveal } from './Reveal'
import { ImagePlaceholder } from './ImagePlaceholder'
import { useT } from '../lib/i18n'

export function HeroLanding() {
  const t = useT()
  return (
    <section className="relative overflow-hidden pt-20 pb-16 sm:pt-28">
      <Container>
        <Reveal>
          <Badge>{t('home.hero.badge')}</Badge>
        </Reveal>
        <Reveal delay={70}>
          <h1 className="mt-5 max-w-3xl text-5xl leading-[1.05] text-white sm:text-7xl">
            {t('home.hero.title')}
          </h1>
        </Reveal>
        <Reveal delay={140}>
          <p className="mt-6 max-w-xl text-lg text-white/55">
            {t('home.hero.subtitle')}
          </p>
        </Reveal>
        <Reveal delay={210}>
          <div className="mt-8 flex items-center gap-3">
            <Button href="/app">
              {t('home.hero.runDemo')} <ArrowRight size={16} />
            </Button>
            <Button variant="secondary" href="/docs">
              {t('home.hero.docs')}
            </Button>
          </div>
        </Reveal>
      </Container>

      <Container className="mt-16">
        <Reveal delay={140} y={24}>
          <ImagePlaceholder label={t('home.hero.shotLabel')} src="/shots/dashboard.png" />
        </Reveal>
      </Container>
    </section>
  )
}
