/**
 * Sugerencias agrupadas por categoría. Cada pill, al hacer clic, llena el
 * input del chat con su texto (no envía directo) para que el usuario pueda
 * editar los placeholders entre paréntesis antes de enviar.
 *
 * Las plantillas vienen del backend (/assistant/suggestions) y se acompañan
 * de una sección dinámica "Preguntas frecuentes" que muestra las top N
 * preguntas reales más usadas (las que el caché ya respondió varias veces).
 */

export function SuggestionPills({ data, onPick, disabled }) {
  if (!data) {
    return (
      <div className="text-center text-xs text-ink-500 py-4">
        Cargando sugerencias…
      </div>
    );
  }

  const { plantillas, frecuentes } = data;

  return (
    <div className="space-y-4">
      {frecuentes?.length > 0 && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-4">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-brand-600 text-lg leading-none mt-0.5">⚡</span>
            <div>
              <div className="text-sm font-semibold text-brand-700">Preguntas frecuentes</div>
              <div className="text-[11px] text-ink-600">
                Estas vienen del caché — la respuesta es instantánea y no descuenta cuota.
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {frecuentes.map((p) => (
              <PillButton
                key={p.texto}
                disabled={disabled}
                onClick={() => onPick(p.texto)}
                etiqueta={`${p.hits} ${p.hits === 1 ? 'vez' : 'veces'}`}
                tone="frecuente"
              >
                {p.texto}
              </PillButton>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {plantillas.map((cat) => (
          <div
            key={cat.categoria}
            className="rounded-lg border border-ink-200 bg-white p-4 flex flex-col"
          >
            <div className="flex items-start gap-2 mb-2">
              <span className="text-brand-600 text-lg leading-none mt-0.5">{cat.icono}</span>
              <div>
                <div className="text-sm font-semibold text-ink-800">{cat.categoria}</div>
                <div className="text-[11px] text-ink-500">{cat.descripcion}</div>
              </div>
            </div>
            <div className="mt-1 flex flex-col gap-1.5">
              {cat.plantillas.map((p) => (
                <PillButton
                  key={p.texto}
                  disabled={disabled}
                  onClick={() => onPick(p.texto)}
                  etiqueta={p.editable ? 'editar' : null}
                  tone="plantilla"
                >
                  {p.texto}
                </PillButton>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[11px] text-ink-500 text-center">
        Las sugerencias <strong>cargan al cuadro de texto</strong> al hacer clic — revíselas, reemplace lo que esté en (paréntesis) y presione Enviar.
      </div>
    </div>
  );
}

function PillButton({ children, disabled, onClick, etiqueta, tone }) {
  const tones = {
    plantilla: 'text-ink-700 bg-ink-50 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200',
    frecuente: 'text-brand-800 bg-white hover:bg-brand-100 hover:border-brand-300'
  };
  const etiquetaTone = etiqueta === 'editar'
    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
    : 'bg-brand-100 text-brand-700 border-brand-300';

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`text-left text-xs border border-transparent rounded-md px-2.5 py-1.5
                 transition disabled:opacity-50 disabled:cursor-not-allowed
                 flex items-center justify-between gap-2 ${tones[tone]}`}
    >
      <span className="flex-1">{children}</span>
      {etiqueta && (
        <span className={`text-[10px] uppercase tracking-wider border rounded px-1 py-0.5 ${etiquetaTone}`}>
          {etiqueta}
        </span>
      )}
    </button>
  );
}
