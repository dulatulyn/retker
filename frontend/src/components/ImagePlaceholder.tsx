import { Image as ImageIcon } from 'lucide-react'

export function ImagePlaceholder({
  label = 'Скриншот продукта',
  hint = 'место под изображение',
  ratio = '16 / 9',
  className = '',
  src,
}: {
  label?: string
  hint?: string
  ratio?: string
  className?: string
  src?: string
}) {
  // если есть картинка — рамка подстраивается под её пропорции (видно фото целиком, без обрезки)
  if (src) {
    return (
      <div className={`relative isolate ${className}`}>
        {/* мягкое белое свечение позади картинки */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 scale-110 rounded-[2.5rem] blur-2xl"
          style={{
            background:
              'radial-gradient(60% 55% at 50% 42%, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 55%, transparent 75%)',
          }}
        />
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl shadow-black/40">
          <img src={src} alt={label} loading="lazy" className="block h-auto w-full" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-surface ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/40">
            <ImageIcon size={20} />
          </div>
          <p className="text-sm text-white/50">{label}</p>
          <p className="text-xs text-white/25">{hint}</p>
        </div>
      </div>
    </div>
  )
}
