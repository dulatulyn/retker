export function PerimeterBadge({ online, provider }: { online: boolean; provider?: string }) {
  const closed = provider === 'ollama' || !online;
  const cls = closed
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
    : 'border-white/10 bg-white/[0.06] text-white/55';
  const label = closed
    ? 'Закрытый контур · оффлайн · данные не покидают периметр'
    : `Облако · ${provider ?? '—'}`;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls}`}
      title={label}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${closed ? 'bg-emerald-400' : 'bg-white/40'}`} />
      {label}
    </span>
  );
}
