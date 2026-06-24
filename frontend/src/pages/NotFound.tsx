import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useT } from '../lib/i18n'

export function NotFound() {
  const t = useT()
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-bg px-6 text-ink">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand/10 blur-[120px]" />
      <div className="relative text-center">
        <Logo className="mx-auto h-12 w-12 text-brand/70" />
        <div className="mt-6 text-7xl font-semibold tracking-tight text-white">404</div>
        <p className="mt-3 text-white/55">{t('auth.notfound.title')}</p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90"
        >
          <ArrowLeft size={16} /> {t('auth.notfound.home')}
        </Link>
      </div>
    </div>
  )
}
