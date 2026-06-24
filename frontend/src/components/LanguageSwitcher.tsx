import { LANGS, useI18n } from '../lib/i18n'

// Compact segmented RU / KZ toggle. Used in the landing navbar and the dashboard header.
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n()
  return (
    <div
      role="group"
      aria-label="Тіл / Язык"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5 ${className}`}>
      {LANGS.map((l) => {
        const active = l.code === lang
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            aria-pressed={active}
            title={l.label}
            className={`rounded-md px-2 py-1 text-xs font-semibold tracking-tight transition-colors ${
              active ? 'bg-brand/20 text-brand' : 'text-white/50 hover:text-white'
            }`}>
            {l.short}
          </button>
        )
      })}
    </div>
  )
}
