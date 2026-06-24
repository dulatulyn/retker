import { Check } from 'lucide-react'
import { Container, Eyebrow } from './ui'
import { Reveal } from './Reveal'
import { ImagePlaceholder } from './ImagePlaceholder'
import { useT } from '../lib/i18n'

const features = [
  {
    eyebrowKey: 'features.split.ai.eyebrow',
    titleKey: 'features.split.ai.title',
    descKey: 'features.split.ai.desc',
    pointKeys: ['features.split.ai.point1', 'features.split.ai.point2', 'features.split.ai.point3'],
    imgKey: 'features.split.ai.img',
    src: '/shots/incidents.png',
  },
  {
    eyebrowKey: 'features.split.react.eyebrow',
    titleKey: 'features.split.react.title',
    descKey: 'features.split.react.desc',
    pointKeys: ['features.split.react.point1', 'features.split.react.point2', 'features.split.react.point3'],
    imgKey: 'features.split.react.img',
    src: '/shots/events.png',
  },
]

export function FeatureSplits() {
  const t = useT()
  return (
    <section className="py-12">
      <Container className="space-y-20">
        {features.map((f, i) => {
          const reversed = i % 2 === 1
          return (
            <div key={f.titleKey} className="grid items-center gap-10 md:grid-cols-2">
              <Reveal className={reversed ? 'md:order-2' : ''}>
                <div>
                  <Eyebrow>{t(f.eyebrowKey)}</Eyebrow>
                  <h3 className="mt-4 text-2xl text-white sm:text-3xl">{t(f.titleKey)}</h3>
                  <p className="mt-4 text-white/55">{t(f.descKey)}</p>
                  <ul className="mt-6 space-y-3">
                    {f.pointKeys.map((p) => (
                      <li key={p} className="flex items-center gap-3 text-[18px] text-white/70">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                          <Check size={13} />
                        </span>
                        {t(p)}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={120} y={24} className={reversed ? 'md:order-1' : ''}>
                <ImagePlaceholder label={t(f.imgKey)} src={f.src} />
              </Reveal>
            </div>
          )
        })}
      </Container>
    </section>
  )
}
