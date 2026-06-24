import { Logo } from './Logo'
import { Container, Badge } from './ui'
import { useT } from '../lib/i18n'

const columns: { title: string; items: { label: string; badge?: boolean }[] }[] = [
  {
    title: 'home.footer.col.product',
    items: [
      { label: 'home.footer.col.product.overview' },
      { label: 'home.footer.col.product.incidents' },
      { label: 'home.footer.col.product.aiAnalyst', badge: true },
      { label: 'home.footer.col.product.reports' },
    ],
  },
  {
    title: 'home.footer.col.solutions',
    items: [
      { label: 'home.footer.col.solutions.unauthorized' },
      { label: 'home.footer.col.solutions.anomalies' },
      { label: 'home.footer.col.solutions.leaks' },
      { label: 'home.footer.col.solutions.phishing' },
    ],
  },
  {
    title: 'home.footer.col.resources',
    items: [
      { label: 'home.footer.col.resources.docs' },
      { label: 'home.footer.col.resources.api' },
      { label: 'home.footer.col.resources.status' },
      { label: 'home.footer.col.resources.changelog', badge: true },
    ],
  },
  {
    title: 'home.footer.col.legal',
    items: [
      { label: 'home.footer.col.legal.privacy' },
      { label: 'home.footer.col.legal.terms' },
      { label: 'home.footer.col.legal.pdn' },
    ],
  },
]

export function Footer() {
  const t = useT()
  return (
    <footer className="border-t border-white/10 pt-16 pb-10">
      <Container>
        <div className="flex flex-col justify-between gap-12 lg:flex-row">
          <div className="max-w-xs">
            <a href="#" className="flex items-center gap-2">
              <Logo className="h-6 w-6 text-white" />
              <span className="text-[18px] font-semibold tracking-tight">retker</span>
            </a>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              {t('home.footer.tagline')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-16">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-[18px] font-semibold text-white">{t(col.title)}</h4>
                <ul className="mt-4 space-y-3">
                  {col.items.map((it) => (
                    <li key={it.label}>
                      <a
                        href="#"
                        className="inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
                      >
                        {t(it.label)}
                        {it.badge && <Badge>{t('home.footer.badge.new')}</Badge>}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex items-center justify-center border-t border-white/10 pt-8 text-sm text-white/40">
          <p className="font-mono text-xs tracking-tight">retker.kz</p>
        </div>
      </Container>
    </footer>
  )
}
