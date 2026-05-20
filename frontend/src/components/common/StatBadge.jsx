export function StatBadge({ label, value, hint, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-800',
    positive: 'bg-semaforo-verde/10 text-semaforo-verde',
    warning: 'bg-semaforo-amarillo/10 text-yellow-700',
    danger: 'bg-semaforo-rojo/10 text-semaforo-rojo',
    info: 'bg-brand-50 text-brand-700'
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${tones[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-xl font-semibold leading-tight">{value}</div>
      {hint && <div className="text-[11px] opacity-70 mt-0.5">{hint}</div>}
    </div>
  );
}
