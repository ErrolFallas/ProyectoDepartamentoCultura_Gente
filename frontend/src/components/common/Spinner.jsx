export function Spinner({ label }) {
  return (
    <div className="flex items-center gap-3 text-ink-500">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
