import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { NivelPill } from '../components/common/NivelPill.jsx';

export function MetodologiaPage() {
  return (
    <>
      <PageHeader
        title="Metodología del termómetro de clima"
        description="Documento de transparencia. Explica cómo se calcula el nivel de cada departamento, qué reglas duras protegen el anonimato y por qué algunas respuestas no entran a los porcentajes."
      />

      <div className="space-y-6">
        <Card title="Resumen en una línea">
          <p className="text-sm text-ink-700">
            Un departamento llega a un nivel cuando un porcentaje del personal que respondió
            ese mes terminó con un <strong>promedio personal bajo</strong>. No miramos respuestas
            sueltas: miramos cómo terminó cada persona en general.
          </p>
        </Card>

        <Card title="Paso 1 — Cómo se etiqueta a cada persona (promedio personal 0-100)">
          <ol className="list-decimal pl-5 space-y-2 text-sm text-ink-700">
            <li>
              Cada respuesta marcada se normaliza a una escala <strong>0-100</strong> aplicando la
              polaridad de la pregunta (directa o inversa).
            </li>
            <li>
              Se promedian <strong>todas las respuestas puntuables</strong> de esa persona.
              Las respuestas <code className="text-xs bg-ink-100 px-1 rounded">NO_APLICA</code> y{' '}
              <code className="text-xs bg-ink-100 px-1 rounded">EN_ESPERA</code> no entran al promedio.
            </li>
            <li>
              Ese promedio personal se clasifica con los siguientes umbrales:
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <UmbralBox tone="rojo" titulo="NEGATIVO" rango="≤ 40 / 100" />
                <UmbralBox tone="amarillo" titulo="NEUTRO" rango="41 – 60 / 100" />
                <UmbralBox tone="verde" titulo="POSITIVO" rango="&gt; 60 / 100" />
              </div>
            </li>
          </ol>
          <p className="text-xs text-ink-500 mt-3">
            Es decir: no contamos <em>cuántas marcas malas</em> hizo una persona. Si su promedio
            general es ≤ 40, queda etiquetada como NEGATIVA aunque haya marcado algunas cosas bien.
          </p>
        </Card>

        <Card title="Paso 2 — Cómo se determina el nivel del departamento">
          <p className="text-sm text-ink-700 mb-3">
            Para cada mes y departamento se calcula:
          </p>
          <pre className="bg-ink-900 text-ink-100 text-xs rounded-lg p-3 overflow-x-auto">
{`pct_negativo = personas_NEGATIVAS / total_personas × 100`}
          </pre>
          <p className="text-sm text-ink-700 mt-3 mb-3">
            Ese porcentaje determina el nivel del termómetro:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-500 border-b border-ink-200">
                  <th className="py-2 pr-3">Nivel</th>
                  <th className="py-2 pr-3">% personal negativo</th>
                  <th className="py-2 pr-3">Significado</th>
                  <th className="py-2">Acción esperada</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-ink-100">
                  <td className="py-2 pr-3"><NivelPill nivel="NEGRO" /></td>
                  <td className="py-2 pr-3 font-medium">≥ 90%</td>
                  <td className="py-2 pr-3 text-ink-700">Crisis</td>
                  <td className="py-2 text-ink-700">Visita inmediata · intervención prioritaria de Cultura y Gente</td>
                </tr>
                <tr className="border-b border-ink-100">
                  <td className="py-2 pr-3"><NivelPill nivel="ROJO" /></td>
                  <td className="py-2 pr-3 font-medium">75% – 89%</td>
                  <td className="py-2 pr-3 text-ink-700">Alto</td>
                  <td className="py-2 text-ink-700">Visita prioritaria al equipo</td>
                </tr>
                <tr className="border-b border-ink-100">
                  <td className="py-2 pr-3"><NivelPill nivel="AMARILLO" /></td>
                  <td className="py-2 pr-3 font-medium">40% – 74%</td>
                  <td className="py-2 pr-3 text-ink-700">Medio</td>
                  <td className="py-2 text-ink-700">Observar y comparar contra el mes anterior</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3"><NivelPill nivel="VERDE" /></td>
                  <td className="py-2 pr-3 font-medium">&lt; 40%</td>
                  <td className="py-2 pr-3 text-ink-700">Estable</td>
                  <td className="py-2 text-ink-700">Sin acción requerida</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-500 mt-3">
            Los umbrales son configurables (variables{' '}
            <code className="bg-ink-100 px-1 rounded">SEMAFORO_*_MIN</code> en el archivo{' '}
            <code className="bg-ink-100 px-1 rounded">.env</code> del backend).
          </p>
        </Card>

        <Card title="Reglas duras (no negociables)">
          <ul className="space-y-3 text-sm text-ink-700">
            <Regla
              titulo="Umbral de anonimato"
              detalle="Si un departamento tuvo menos de 5 respuestas en el período, NO se genera alerta y no se exponen sus porcentajes. Esto protege la identidad de quienes respondieron en equipos pequeños."
            />
            <Regla
              titulo="Polaridad confirmada por RRHH"
              detalle="Cuando llega una pregunta nueva, la IA sugiere su polaridad (directa, inversa o neutra). Mientras RRHH no confirme esa polaridad, las respuestas a esa pregunta quedan EN_ESPERA y no contaminan los promedios."
            />
            <Regla
              titulo="Preguntas demográficas (NEUTRA) no puntúan"
              detalle="Preguntas tipo 'cantidad de personas a cargo' o 'género' no aportan sentimiento. Se guardan para segmentar pero no entran al cálculo del promedio personal."
            />
            <Regla
              titulo="Respuestas NO_APLICA se descartan"
              detalle="Si la persona marca explícitamente 'No aplica', esa respuesta queda fuera del promedio. No se interpreta ni como positiva ni como negativa."
            />
            <Regla
              titulo="Anonimato total: nunca se identifica a la persona"
              detalle="El sistema solo guarda empresa + departamento + fecha + respuestas. No hay nombre, correo, ni ningún campo que permita rastrear quién contestó."
            />
            <Regla
              titulo="Snapshots mensuales inmutables"
              detalle="Al cerrar el mes, los porcentajes se congelan en una tabla aparte. Aunque después se recalifique alguna pregunta, los snapshots históricos no cambian — la trazabilidad queda intacta."
            />
          </ul>
        </Card>

        <Card title="Ejemplo paso a paso">
          <p className="text-sm text-ink-700 mb-3">
            Departamento <strong>Finanzas</strong> tuvo <strong>20 respuestas</strong> en el mes.
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-ink-700">
            <li>De esas 20, 18 personas terminaron con promedio personal ≤ 40 → NEGATIVAS.</li>
            <li>2 personas terminaron entre 41 y 60 → NEUTRAS.</li>
            <li>
              <code className="bg-ink-100 px-1 rounded">pct_negativo = 18 / 20 × 100 = 90.00%</code>
            </li>
            <li>
              90 ≥ 90 → el departamento queda en{' '}
              <NivelPill nivel="NEGRO" /> (crisis · visita inmediata).
            </li>
          </ol>
          <div className="mt-4 p-3 bg-ink-100 rounded text-xs text-ink-600">
            Si el mismo departamento hubiera tenido solo <strong>4 respuestas</strong>, no se
            generaría alerta (umbral de anonimato &lt; 5) — aunque el porcentaje fuera 100%.
          </div>
        </Card>

        <Card title="Por qué no se llama 'semáforo'">
          <p className="text-sm text-ink-700">
            La metáfora del semáforo solo admite tres niveles (verde, amarillo, rojo) y sugiere
            una decisión binaria de tránsito. Usamos <strong>termómetro de clima</strong> porque:
          </p>
          <ul className="list-disc pl-5 mt-2 text-sm text-ink-700 space-y-1">
            <li>Es un instrumento de medición graduada → admite naturalmente más de tres niveles.</li>
            <li>Conecta con el lenguaje de "clima organizacional" que usa RRHH.</li>
            <li>El nivel NEGRO comunica explícitamente que la situación supera el rojo y requiere acción inmediata, no solo prioritaria.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}

function UmbralBox({ tone, titulo, rango }) {
  const tones = {
    rojo: 'bg-semaforo-rojo/10 border-semaforo-rojo/30 text-semaforo-rojo',
    amarillo: 'bg-semaforo-amarillo/10 border-semaforo-amarillo/40 text-yellow-700',
    verde: 'bg-semaforo-verde/10 border-semaforo-verde/30 text-semaforo-verde'
  };
  return (
    <div className={`border rounded-lg p-3 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase tracking-wider">{titulo}</div>
      <div className="text-lg font-semibold mt-0.5">{rango}</div>
    </div>
  );
}

function Regla({ titulo, detalle }) {
  return (
    <li className="border-l-2 border-brand-500 pl-3">
      <div className="font-medium text-ink-800">{titulo}</div>
      <div className="text-ink-600 text-[13px] mt-0.5">{detalle}</div>
    </li>
  );
}
