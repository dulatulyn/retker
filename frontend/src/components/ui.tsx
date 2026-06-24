import type { ReactNode } from 'react'

export function Container({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-5 sm:px-6 ${className}`}>
      {children}
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href = '#',
  className = '',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'brand'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  className?: string
}) {
  const v = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    brand: 'btn-brand',
  }[variant]
  const s = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''
  return (
    <a href={href} className={`btn ${v} ${s} ${className}`}>
      {children}
    </a>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-medium tracking-tight text-white/50">{children}</p>
  )
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand/15 px-2 py-0.5 text-[13px] font-semibold tracking-tight text-brand">
      {children}
    </span>
  )
}

export function KitLabel({ children }: { children: ReactNode }) {
  return (
    <div className="border-y border-white/10 bg-white/[0.02]">
      <Container className="flex items-center gap-3 py-3">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">
          {children}
        </span>
      </Container>
    </div>
  )
}
