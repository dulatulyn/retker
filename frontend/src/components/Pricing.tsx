import { Check } from 'lucide-react'
import { Container, Eyebrow, Button, Badge } from './ui'
import { useT } from '../lib/i18n'

const tiers = [
  {
    nameKey: 'features.pricing.start.name',
    price: '0 ₸',
    noteKey: 'features.pricing.start.note',
    featureKeys: [
      'features.pricing.start.f1',
      'features.pricing.start.f2',
      'features.pricing.start.f3',
      'features.pricing.start.f4',
    ],
    ctaKey: 'features.pricing.start.cta',
    variant: 'secondary' as const,
    featured: false,
  },
  {
    nameKey: 'features.pricing.team.name',
    price: '290 000 ₸',
    noteKey: 'features.pricing.team.note',
    featureKeys: [
      'features.pricing.team.f1',
      'features.pricing.team.f2',
      'features.pricing.team.f3',
      'features.pricing.team.f4',
      'features.pricing.team.f5',
    ],
    ctaKey: 'features.pricing.team.cta',
    variant: 'primary' as const,
    featured: true,
  },
  {
    nameKey: 'features.pricing.enterprise.name',
    priceKey: 'features.pricing.enterprise.price',
    noteKey: 'features.pricing.enterprise.note',
    featureKeys: [
      'features.pricing.enterprise.f1',
      'features.pricing.enterprise.f2',
      'features.pricing.enterprise.f3',
      'features.pricing.enterprise.f4',
      'features.pricing.enterprise.f5',
    ],
    ctaKey: 'features.pricing.enterprise.cta',
    variant: 'secondary' as const,
    featured: false,
  },
]

export function Pricing() {
  const t = useT()
  return (
    <section className="py-24">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>{t('features.pricing.eyebrow')}</Eyebrow>
          <h2 className="mt-3 text-4xl text-white sm:text-5xl">{t('features.pricing.title')}</h2>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.nameKey}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                tier.featured
                  ? 'border-brand/40 bg-surface-2'
                  : 'border-white/10 bg-surface'
              }`}
            >
              {tier.featured && (
                <div className="absolute right-6 top-7">
                  <Badge>{t('features.pricing.popular')}</Badge>
                </div>
              )}
              <h3 className="text-lg font-semibold text-white">{t(tier.nameKey)}</h3>
              <div className="mt-4 flex items-end gap-1.5">
                <span className="text-3xl font-medium tracking-tight text-white">
                  {tier.priceKey ? t(tier.priceKey) : tier.price}
                </span>
                <span className="pb-1 text-sm text-white/45">{t(tier.noteKey)}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {tier.featureKeys.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                    <Check size={15} className="text-brand" /> {t(f)}
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Button variant={tier.variant} className="w-full">
                  {t(tier.ctaKey)}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
