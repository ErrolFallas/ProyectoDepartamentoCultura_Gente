/**
 * Sección colapsada "Cómo llegué a este dato" que traduce las consultas
 * técnicas en frases entendibles por personal de RRHH.
 *
 * Sin nombres de funciones, sin JSON, sin parámetros crudos: solo una
 * descripción humana de qué información se buscó y un conteo del
 * volumen consultado.
 */

const MESES = {
  '01': 'enero', '02': 'febrero', '03': 'marzo', '04': 'abril',
  '05': 'mayo', '06': 'junio', '07': 'julio', '08': 'agosto',
  '09': 'septiembre', '10': 'octubre', '11': 'noviembre', '12': 'diciembre'
};

function periodoHumano(p) {
  if (!p) return 'el período actual';
  const m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m) return `${MESES[m[2]] ?? m[2]} de ${m[1]}`;
  if (/^\d{4}$/.test(p)) return `el año ${p}`;
  return p;
}

function nivelHumano(n) {
  if (!n) return '';
  const map = {
    NEGRO: 'nivel crítico (negro)',
    ROJO: 'nivel alto (rojo)',
    AMARILLO: 'nivel medio (amarillo)',
    VERDE: 'nivel estable (verde)'
  };
  return map[n] ?? n.toLowerCase();
}

function resumirVolumen(result) {
  if (!result || typeof result !== 'object') return null;
  if (Array.isArray(result)) {
    return `${result.length} ${result.length === 1 ? 'resultado' : 'resultados'}`;
  }
  for (const k of ['empresas', 'departamentos', 'alertas', 'items', 'ranking', 'historia']) {
    if (Array.isArray(result[k])) {
      return `${result[k].length} ${k}`;
    }
  }
  if (result.n_respuestas != null) {
    return `${result.n_respuestas} respuestas anónimas`;
  }
  if (result.total != null) {
    return `${result.total} resultados`;
  }
  return null;
}

function describir(toolCall) {
  const { name, args = {}, result } = toolCall;
  const periodo = periodoHumano(args.periodo);
  const nivel = nivelHumano(args.nivel);
  const volumen = resumirVolumen(result);
  const sufijoVol = volumen ? ` · se obtuvieron ${volumen}` : '';

  switch (name) {
    case 'listarEmpresas':
      return `Consulté la lista de empresas activas${sufijoVol}.`;
    case 'listarDepartamentos':
      return `Consulté los departamentos de la empresa indicada${sufijoVol}.`;
    case 'obtenerFocosDelPeriodo':
      return `Revisé qué departamentos requieren atención en ${periodo}${sufijoVol}.`;
    case 'listarAlertas':
      return `Listé las alertas${nivel ? ` de ${nivel}` : ''} en ${periodo}${sufijoVol}.`;
    case 'empresasConMasAlertas':
      return `Conté las alertas${nivel ? ` de ${nivel}` : ''} por empresa en ${periodo}${sufijoVol}.`;
    case 'obtenerEstadisticasEntidad':
      return `Obtuve los porcentajes positivo/neutro/negativo en ${periodo}${sufijoVol}.`;
    case 'compararEntidades':
      return `Comparé los porcentajes de las entidades seleccionadas en ${periodo}.`;
    case 'obtenerRanking':
      return `Calculé el ranking solicitado para ${periodo}${sufijoVol}.`;
    case 'obtenerHistoricoMensual':
      return `Recuperé la evolución mes a mes${sufijoVol}.`;
    case 'obtenerDistribucionPorDiaSemana':
      return `Analicé en qué días de la semana se concentran las emociones negativas en ${periodo}.`;
    case 'obtenerCronicidad':
      return `Verifiqué cuántos meses lleva esta entidad en alerta.`;
    case 'obtenerEstadisticasDePregunta':
      return `Consulté los resultados de una pregunta específica en ${periodo}.`;
    case 'listarDepartamentosCronicos':
      return `Identifiqué los departamentos con 3 o más meses consecutivos en alerta${sufijoVol}.`;
    case 'buscarEntidadPorNombre':
      return 'Busqué la entidad mencionada por su nombre.';
    case 'obtenerContextoActual':
      return 'Consulté el contexto general del sistema (totales y umbrales).';
    default:
      return `Realicé una consulta a la información de la encuesta${sufijoVol}.`;
  }
}

export function ToolCallDetails({ toolCalls }) {
  const descripciones = toolCalls.map(describir);

  return (
    <details className="mt-3 border-t border-ink-100 pt-2 group">
      <summary className="text-[11px] text-ink-500 cursor-pointer select-none hover:text-ink-700 transition">
        <span className="font-semibold">Cómo llegué a este dato</span>
        <span className="ml-1 text-ink-400">
          ({toolCalls.length} {toolCalls.length === 1 ? 'consulta' : 'consultas'} a la información)
        </span>
      </summary>
      <ol className="mt-2 space-y-1.5 text-[12px] text-ink-700 list-decimal pl-5">
        {descripciones.map((texto, i) => (
          <li key={i}>{texto}</li>
        ))}
      </ol>
      <p className="text-[10px] text-ink-400 mt-2 italic">
        Todas las consultas se realizaron sobre datos agregados y anónimos. Nunca se accede a respuestas individuales.
      </p>
    </details>
  );
}
