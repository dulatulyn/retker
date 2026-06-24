export function RadarBackground({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`}>
      <style>{`
        @keyframes radar-spin { to { transform: rotate(360deg); } }
        @keyframes radar-pulse { 0%,100%{opacity:0;transform:scale(.6)} 12%{opacity:1;transform:scale(1)} 70%{opacity:.15;transform:scale(1.4)} }
        .radar-sweep {
          background: conic-gradient(from 0deg,
            rgba(255,255,255,0.22), rgba(255,255,255,0.05) 16%, transparent 40%);
          -webkit-mask: radial-gradient(circle, #000 58%, transparent 72%);
          mask: radial-gradient(circle, #000 58%, transparent 72%);
          animation: radar-spin 4.5s linear infinite;
        }
        .radar-blip { box-shadow: 0 0 10px rgba(255,255,255,0.7); animation: radar-pulse 3.4s ease-out infinite; }
      `}</style>

      <div className="absolute left-1/2 top-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {[12, 23, 34, 45].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.15" />
          ))}
          <line x1="50" y1="3" x2="50" y2="97" stroke="rgba(255,255,255,0.06)" strokeWidth="0.15" />
          <line x1="3" y1="50" x2="97" y2="50" stroke="rgba(255,255,255,0.06)" strokeWidth="0.15" />
          <line x1="18" y1="18" x2="82" y2="82" stroke="rgba(255,255,255,0.04)" strokeWidth="0.12" />
          <line x1="82" y1="18" x2="18" y2="82" stroke="rgba(255,255,255,0.04)" strokeWidth="0.12" />
        </svg>

        <div className="radar-sweep absolute inset-0 rounded-full" />

        <span className="radar-blip absolute h-1 w-1 rounded-full bg-white" style={{ left: '66%', top: '40%' }} />
        <span className="radar-blip absolute h-1 w-1 rounded-full bg-white" style={{ left: '38%', top: '60%', animationDelay: '1.3s' }} />
        <span className="radar-blip absolute h-1.5 w-1.5 rounded-full bg-white" style={{ left: '57%', top: '68%', animationDelay: '2.5s' }} />
      </div>
    </div>
  )
}
