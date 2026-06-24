import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { dict } from '../locales'

export type Lang = 'ru' | 'kk'

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'kk', label: 'Қазақша', short: 'KZ' },
]

const STORAGE_KEY = 'retker.lang'
const DEFAULT_LANG: Lang = 'ru'

type Vars = Record<string, string | number>

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, vars?: Vars) => string
}

const LangContext = createContext<Ctx | null>(null)

function resolveInitial(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'ru' || saved === 'kk') return saved
  } catch {
    /* localStorage unavailable */
  }
  return DEFAULT_LANG
}

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const table = dict[lang] as Record<string, string>
  let str = table[key]
  if (str === undefined) str = (dict.ru as Record<string, string>)[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return str
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(resolveInitial)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const value: Ctx = {
    lang,
    setLang: setLangState,
    t: (key, vars) => translate(lang, key, vars),
  }

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useI18n(): Ctx {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider')
  return ctx
}

export function useT() {
  return useI18n().t
}
