import { Navbar } from '../components/Navbar'
import { HeroLanding } from '../components/HeroLanding'
import { HowItWorks } from '../components/HowItWorks'
import { FeatureSplits } from '../components/FeatureSplits'
import { LiveConsole } from '../components/LiveConsole'
import { ApiPlayground } from '../components/ApiPlayground'
import { CTA } from '../components/CTA'
import { Footer } from '../components/Footer'
import { Reveal } from '../components/Reveal'

export function Landing() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <Navbar />
      <main>
        <HeroLanding />
        <HowItWorks />
        <FeatureSplits />
        <Reveal>
          <LiveConsole />
        </Reveal>
        <Reveal>
          <ApiPlayground />
        </Reveal>
        <Reveal>
          <CTA />
        </Reveal>
      </main>
      <Footer />
    </div>
  )
}
