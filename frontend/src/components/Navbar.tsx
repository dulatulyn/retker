import { Logo } from './Logo'
import { Container, Button } from './ui'
import { useT } from '../lib/i18n'
import { LanguageSwitcher } from './LanguageSwitcher'

const links = ['home.nav.product', 'home.nav.features', 'home.nav.solutions', 'home.nav.pricing', 'home.nav.docs']

export function Navbar() {
  const t = useT()
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6 text-white" />
          <span className="text-[18px] font-semibold tracking-tight">retker</span>
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l}
              href="#"
              className="rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t(l)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="secondary" size="sm" href="/docs" className="hidden sm:inline-flex">
            {t('common.docs')}
          </Button>
          <Button variant="primary" size="sm" href="/app">
            {t('common.signIn')}
          </Button>
        </div>
      </Container>
    </header>
  )
}
