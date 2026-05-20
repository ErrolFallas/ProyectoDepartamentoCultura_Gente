export function EmptyState({ title, description, icon = '∅' }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-300 bg-white py-10 text-center">
      <div className="text-3xl text-ink-300 mb-2">{icon}</div>
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {description && <p className="text-xs text-ink-500 mt-1 max-w-md mx-auto">{description}</p>}
    </div>
  );
}
