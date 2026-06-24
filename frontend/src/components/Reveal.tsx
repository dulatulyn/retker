import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export function Reveal({
  children,
  delay = 0,
  y = 16,
  blur = 10,
  className = '',
}: {
  children: ReactNode
  delay?: number
  y?: number
  blur?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const ease = 'cubic-bezier(0.22,1,0.36,1)'
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : `translateY(${y}px)`,
        filter: shown ? 'blur(0px)' : `blur(${blur}px)`,
        transition: `opacity 0.8s ${ease} ${delay}ms, transform 0.8s ${ease} ${delay}ms, filter 0.8s ${ease} ${delay}ms`,
        willChange: 'opacity, transform, filter',
      }}
    >
      {children}
    </div>
  )
}
