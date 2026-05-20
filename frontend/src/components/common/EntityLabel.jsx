/**
 * Muestra un nombre acompañado siempre de su tipo (Empresa / Departamento)
 * para evitar ambigüedad. Útil en tarjetas, listas y subtítulos donde antes
 * sólo aparecía el nombre suelto.
 *
 * Variantes:
 *   - default: dos líneas, etiqueta arriba pequeña, nombre debajo grande
 *   - compact: una línea inline, "Empresa GGDI" o "Departamento Operaciones (GGDI)"
 *   - inline:  línea con pill discreto al inicio
 */
export function EntityLabel({
  scope,
  nombre,
  empresa,
  variant = 'default',
  size = 'md'
}) {
  const tipo = scope === 'COMPANY' ? 'Empresa' : 'Departamento';
  const icon = scope === 'COMPANY' ? '🏢' : '👥';

  if (variant === 'compact') {
    if (scope === 'DEPARTMENT') {
      const empresaTexto = typeof empresa === 'string' ? empresa : empresa?.nombre;
      return (
        <span className="text-ink-700">
          <strong>{tipo}</strong> {nombre}
          {empresaTexto && <span className="text-ink-500"> · de la empresa {empresaTexto}</span>}
        </span>
      );
    }
    return (
      <span className="text-ink-700">
        <strong>{tipo}</strong> {nombre}
      </span>
    );
  }

  if (variant === 'inline') {
    const empresaTexto = typeof empresa === 'string' ? empresa : empresa?.nombre;
    return (
      <span className="inline-flex items-baseline gap-2">
        <span className="pill bg-ink-100 text-ink-600 text-[10px]">{tipo}</span>
        <span className="font-medium text-ink-800">{nombre}</span>
        {scope === 'DEPARTMENT' && empresaTexto && (
          <span className="text-xs text-ink-500">en {empresaTexto}</span>
        )}
      </span>
    );
  }

  // default
  const empresaTexto = typeof empresa === 'string' ? empresa : empresa?.nombre;
  const sz = size === 'lg' ? 'text-lg' : 'text-base';
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
        <span aria-hidden>{icon}</span>
        {tipo}
      </div>
      <div className={`${sz} font-semibold text-ink-900 leading-tight`}>{nombre}</div>
      {scope === 'DEPARTMENT' && empresaTexto && (
        <div className="text-[11px] text-ink-500 mt-0.5">
          de la empresa <span className="font-medium text-ink-700">{empresaTexto}</span>
        </div>
      )}
    </div>
  );
}
