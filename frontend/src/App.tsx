import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { LanguageProvider, useI18n } from './lib/i18n'
import { Landing } from './pages/Landing'
import { Dashboard } from './pages/Dashboard'
import { Docs } from './pages/Docs'
import { Login } from './pages/Login'
import { TestEnv } from './pages/TestEnv'
import { NotFound } from './pages/NotFound'

const TITLE_KEYS: Record<string, string> = {
  '/': 'common.title.home',
  '/login': 'common.title.login',
  '/app': 'common.title.dashboard',
  '/docs': 'common.title.docs',
}

function TitleManager() {
  const { pathname } = useLocation()
  const { t, lang } = useI18n()
  useEffect(() => {
    document.title = t(TITLE_KEYS[pathname] ?? 'common.title.fallback')
  }, [pathname, t, lang])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <TitleManager />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<Dashboard />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/test" element={<TestEnv />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
