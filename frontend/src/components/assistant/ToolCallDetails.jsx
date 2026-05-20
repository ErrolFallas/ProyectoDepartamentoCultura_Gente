/**
 * Bloque expandible que muestra exactamente qué herramientas usó la IA
 * para componer la respuesta. Sirve como auditoría: RRHH puede ver el
 * JSON crudo que devolvió la base de datos.
 */
export function ToolCallDetails({ toolCalls }) {
  return (
    <details className="mt-3 border-t border-ink-100 pt-2 group">
      <summary className="text-[11px] text-ink-500 cursor-pointer select-none hover:text-ink-700 transition">
        <span className="font-semibold">Datos consultados</span>
        <span className="ml-1 text-ink-400">
          ({toolCalls.length} {toolCalls.length === 1 ? 'consulta' : 'consultas'} a la base)
        </span>
      </summary>
      <div className="mt-2 space-y-3">
        {toolCalls.map((tc, i) => (
          <div key={i} className="rounded-lg bg-ink-50 border border-ink-100 p-2.5">
            <div className="flex items-center gap-2 text-[11px] mb-1">
              <span className="pill bg-brand-50 text-brand-700">#{i + 1}</span>
              <code className="font-mono text-ink-800 font-semibold">{tc.name}</code>
            </div>
            {Object.keys(tc.args ?? {}).length > 0 && (
              <div className="text-[11px] text-ink-600 mb-1">
                <span className="text-ink-400">Argumentos: </span>
                <code className="font-mono">{JSON.stringify(tc.args)}</code>
              </div>
            )}
            <details>
              <summary className="text-[11px] text-ink-500 cursor-pointer hover:text-ink-700">
                Resultado
              </summary>
              <pre className="mt-1 text-[10px] text-ink-700 bg-white border border-ink-100 rounded p-2 overflow-x-auto max-h-48">
                {JSON.stringify(tc.result, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </details>
  );
}
