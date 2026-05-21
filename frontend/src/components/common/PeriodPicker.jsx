import { useMemo } from 'react';

/**
 * Selector de período en formato YYYY-MM. Lista los últimos N meses
 * más una opción "Año actual" (YYYY).
 */
export function PeriodPicker({
  value,
  onChange,
  months = 12,
  includeYear = true,
  label = 'Período',
  hint = null,
  title = null
}) {
  const opciones = useMemo(() => {
    const out = [];
    const now = new Date();
    for (let i = 0; i < months; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const code = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const text = d.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
      out.push({ code, label: text });
    }
    if (includeYear) {
      out.push({ code: String(now.getFullYear()), label: `Año ${now.getFullYear()}` });
    }
    return out;
  }, [months, includeYear]);

  return (
    <label className="block">
      <span className="label" title={title ?? undefined}>{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {opciones.map((o) => (
          <option key={o.code} value={o.code}>{o.label}</option>
        ))}
      </select>
      {hint && <span className="block text-[10px] text-ink-500 mt-1">{hint}</span>}
    </label>
  );
}
