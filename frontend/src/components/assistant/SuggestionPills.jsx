/**
 * Sugerencias agrupadas por categoría. Cada tarjeta de categoría tiene
 * un título y un set de preguntas ejemplo en formato pill clickeable.
 *
 * Diseñado para el estado vacío del chat: el usuario ve de un vistazo
 * "¿qué tipo de cosas le puedo preguntar?" sin pensar en comandos.
 */

const CATEGORIAS = [
  {
    titulo: 'Estado actual del semáforo',
    icono: '◉',
    descripcion: 'Identifique qué equipos requieren atención inmediata',
    preguntas: [
      '¿Qué empresa tiene la mayor cantidad de semáforos rojos este mes?',
      '¿Cuántos departamentos están en rojo y a qué empresas pertenecen?',
      '¿Hay focos de atención en este período?'
    ]
  },
  {
    titulo: 'Métricas y comparativas',
    icono: '⇆',
    descripcion: 'Compare entidades o consulte cifras específicas',
    preguntas: [
      '¿Cómo están los porcentajes de GGDI este mes?',
      'Compare GGDI y AVON en este período',
      '¿Cuál es el ranking de empresas por % positivo?'
    ]
  },
  {
    titulo: 'Análisis temporal',
    icono: '⤴',
    descripcion: 'Tendencias, cronicidad y patrones por día',
    preguntas: [
      '¿Hay algún departamento con alerta crónica?',
      '¿En qué día de la semana se concentran las emociones negativas?',
      '¿Cómo evolucionó GGDI en los últimos meses?'
    ]
  }
];

export function SuggestionPills({ onPick, disabled }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {CATEGORIAS.map((cat) => (
        <div
          key={cat.titulo}
          className="rounded-lg border border-ink-200 bg-white p-4 flex flex-col"
        >
          <div className="flex items-start gap-2 mb-1">
            <span className="text-brand-600 text-lg leading-none mt-0.5">{cat.icono}</span>
            <div>
              <div className="text-sm font-semibold text-ink-800">{cat.titulo}</div>
              <div className="text-[11px] text-ink-500">{cat.descripcion}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {cat.preguntas.map((p) => (
              <button
                key={p}
                disabled={disabled}
                onClick={() => onPick(p)}
                className="text-left text-xs text-ink-700 bg-ink-50 hover:bg-brand-50
                           hover:text-brand-700 border border-transparent
                           hover:border-brand-200 rounded-md px-2.5 py-1.5
                           transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
