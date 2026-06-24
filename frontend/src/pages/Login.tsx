import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { Logo } from '../components/Logo'
import { RadarBackground } from '../components/RadarBackground'
import { useAuth } from '../lib/auth'
import { useT } from '../lib/i18n'

export function Login() {
  const t = useT()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('demo')
  const [password, setPassword] = useState('demo12345')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username, password)
      navigate('/app')
    } catch (err: any) {
      setError(err.message || t('auth.login.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-bg text-ink lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-surface p-12 lg:flex">
        <RadarBackground className="absolute inset-0 h-full w-full" />

        <Link to="/" className="relative z-10 flex items-center gap-2">
          <Logo className="h-7 w-7 text-white" />
          <span className="text-lg font-semibold tracking-tight">retker</span>
        </Link>

        <h2 className="relative z-10 max-w-xs text-3xl font-medium leading-tight text-white">
          {t('auth.login.tagline')}
        </h2>

        <p className="relative z-10 text-sm text-white/30">© 2026 retker · retker.kz</p>
      </div>

      <div className="relative flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/45 transition-colors hover:text-white lg:hidden"
          >
            <ArrowLeft size={15} /> {t('auth.login.toSite')}
          </Link>

          <h1 className="text-2xl font-semibold tracking-tight text-white">{t('auth.login.title')}</h1>
          <p className="mt-1.5 text-sm text-white/50">{t('auth.login.subtitle')}</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="text-sm text-white/55">{t('auth.login.usernameLabel')}</label>
              <input
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand/60 focus:bg-black/60"
              />
            </div>
            <div>
              <label className="text-sm text-white/55">{t('auth.login.passwordLabel')}</label>
              <input
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand/60 focus:bg-black/60"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60"
            >
              {busy ? t('auth.login.busy') : t('common.signIn')} {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white/45">
            <span className="rounded bg-brand/15 px-1.5 py-0.5 font-semibold text-brand">{t('auth.login.demoBadge')}</span>
            <span className="font-mono text-white/70">demo / demo12345</span>
          </div>

          <Link
            to="/"
            className="mt-6 hidden items-center gap-1.5 text-sm text-white/40 transition-colors hover:text-white lg:inline-flex"
          >
            <ArrowLeft size={15} /> {t('auth.login.toSite')}
          </Link>
        </div>
      </div>
    </div>
  )
}
