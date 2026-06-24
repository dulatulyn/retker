import { useState } from 'react'
import { useT } from '../lib/i18n'

export function CookieBanner() {
  const t = useT()
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div className="fixed bottom-5 left-5 z-[100] w-[360px] max-w-[calc(100vw-2.5rem)]">
      <div
        className="flex items-center gap-5 rounded-[14px] bg-white p-4 pl-5"
        style={{
          boxShadow:
            '0 10px 24px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(0,0,0,0.05)',
        }}
      >
        <p className="text-[16px] leading-[1.55] text-[#222]">
          {t('home.cookie.text')}
        </p>
        <button
          onClick={() => setOpen(false)}
          className="shrink-0 rounded-lg bg-[#eee] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#e2e2e2]"
        >
          {t('home.cookie.accept')}
        </button>
      </div>
    </div>
  )
}
