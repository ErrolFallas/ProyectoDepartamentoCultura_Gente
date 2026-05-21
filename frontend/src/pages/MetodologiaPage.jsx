import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { NivelPill } from '../components/common/NivelPill.jsx';

export function MetodologiaPage() {
  return (
    <>
      <PageHeader
        title="Metodología del termómetro de clima"
        description="Documento de transparencia para Cultura y Gente. Explica, en lenguaje cotidiano, cómo el sistema clasifica cada departamento, qué reglas protegen el anonimato del personal y por qué algunas respuestas no entran al cálculo."
      />

      <div className="space-y-6">
        <Card title="La idea en una frase">
          <p className="text-sm text-ink-700">
            Un departamento sube de nivel en el termómetro cuando una porción importante de su
            personal terminó el mes con un <strong>estado general bajo</strong>. No miramos respuestas
            aisladas: miramos cómo se sintió cada persona <em>en promedio</em> durante todo el formulario.
          </p>
        </Card>

        <Card title="Paso 1 — Cómo clasificamos a cada persona que respondió">
          <p className="text-sm text-ink-700 mb-3">
            Cada formulario contestado se convierte en un <strong>puntaje personal de 0 a 100</strong>,
            donde 0 representa el peor estado y 100 el mejor. Lo hacemos así:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-ink-700">
            <li>
              A cada respuesta se le asigna un valor entre 0 y 100, considerando si la pregunta
              está formulada en positivo (ej. "Me siento valorado") o en negativo
              (ej. "Siento estrés frecuente"). Cultura y Gente aprueba esa clasificación antes
              de que la pregunta cuente.
            </li>
            <li>
              Se promedian <strong>todas las respuestas que aportan sentimiento</strong>.
              Las marcadas como <em>"No aplica"</em> o como <em>"En espera de revisión"</em>
              se dejan fuera, para no distorsionar el resultado.
            </li>
            <li>
              Según el promedio obtenido, la persona queda clasificada en una de tres categorías:
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <UmbralBox tone="rojo" titulo="ESTADO NEGATIVO" rango="0 a 40 puntos" />
                <UmbralBox tone="amarillo" titulo="ESTADO NEUTRO" rango="41 a 60 puntos" />
                <UmbralBox tone="verde" titulo="ESTADO POSITIVO" rango="61 a 100 puntos" />
              </div>
            </li>
          </ol>
          <p className="text-xs text-ink-500 mt-3">
            En otras palabras: no contamos cuántas respuestas individuales fueron negativas.
            Si el <strong>conjunto</strong> de respuestas de una persona promedia 40 o menos,
            esa persona queda contada como "estado negativo", aunque algunas respuestas hayan
            sido positivas.
          </p>
        </Card>

        <Card title="Paso 2 — Cómo se determina el nivel del departamento">
          <p className="text-sm text-ink-700 mb-3">
            Una vez clasificadas las personas, calculamos qué <strong>porcentaje del personal</strong>
            del departamento quedó en estado negativo durante el mes. Ese porcentaje determina el nivel:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-500 border-b border-ink-200">
                  <th className="py-2 pr-3">Nivel</th>
                  <th className="py-2 pr-3">% del personal en estado negativo</th>
                  <th className="py-2 pr-3">Significado</th>
                  <th className="py-2">Acción esperada de Cultura y Gente</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-ink-100">
                  <td className="py-2 pr-3"><NivelPill nivel="NEGRO" /></td>
                  <td className="py-2 pr-3 font-medium">90% o más</td>
                  <td className="py-2 pr-3 text-ink-700">Crisis de clima</td>
                  <td className="py-2 text-ink-700">Visita inmediata · intervención prioritaria del equipo</td>
                </tr>
                <tr className="border-b border-ink-100">
                  <td className="py-2 pr-3"><NivelPill nivel="ROJO" /></td>
                  <td className="py-2 pr-3 font-medium">entre 75% y 89%</td>
                  <td className="py-2 pr-3 text-ink-700">Clima alto de riesgo</td>
                  <td className="py-2 text-ink-700">Acercamiento prioritario al equipo en las próximas semanas</td>
                </tr>
                <tr className="border-b border-ink-100">
                  <td className="py-2 pr-3"><NivelPill nivel="AMARILLO" /></td>
                  <td className="py-2 pr-3 font-medium">entre 40% y 74%</td>
                  <td className="py-2 pr-3 text-ink-700">Clima medio · zona de atención</td>
                  <td className="py-2 text-ink-700">Monitorear y comparar contra el mes anterior</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3"><NivelPill nivel="VERDE" /></td>
                  <td className="py-2 pr-3 font-medium">menos del 40%</td>
                  <td className="py-2 pr-3 text-ink-700">Clima estable</td>
                  <td className="py-2 text-ink-700">No requiere acción · sostener buenas prácticas</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-500 mt-3">
            Los porcentajes que separan cada nivel pueden ajustarse según las políticas internas
            de Cultura y Gente. Si en algún momento la organización desea cambiar, por ejemplo,
            el umbral del nivel rojo, basta con coordinarlo con el equipo de soporte técnico.
          </p>
        </Card>

        <Card title="Reglas que el sistema nunca rompe">
          <ul className="space-y-3 text-sm text-ink-700">
            <Regla
              titulo="Anonimato en equipos pequeños"
              detalle="Si un departamento recibió menos de 5 respuestas en el mes, el sistema NO publica un nivel ni genera alertas. Es la única forma de garantizar que, en equipos chicos, nadie pueda deducir quién respondió qué."
            />
            <Regla
              titulo="Nada cuenta sin la aprobación de Cultura y Gente"
              detalle="Cuando llega una pregunta nueva al sistema, la IA propone una clasificación inicial. Hasta que el equipo de Cultura y Gente la revise y confirme, las respuestas a esa pregunta quedan en espera y no afectan los porcentajes del departamento."
            />
            <Regla
              titulo="Las preguntas demográficas no califican el clima"
              detalle="Preguntas como 'cuántas personas tiene a su cargo' o 'área de la empresa' sirven para segmentar y comparar, pero no aportan sentimiento. Por eso no influyen en el puntaje personal ni en el nivel del departamento."
            />
            <Regla
              titulo="Las respuestas 'No aplica' se respetan"
              detalle="Si una persona considera que una pregunta no es relevante a su situación y la marca como 'No aplica', el sistema la deja fuera del cálculo. No se interpreta ni como buena ni como mala señal."
            />
            <Regla
              titulo="Anonimato total: nunca se identifica a la persona"
              detalle="El sistema solo registra empresa, departamento, fecha y respuestas. No guarda nombre, correo, identificación, ni ningún dato que permita saber quién contestó. Cultura y Gente trabaja siempre sobre datos agregados."
            />
            <Regla
              titulo="Lo que pasó, queda escrito"
              detalle="Al cerrar cada mes, los porcentajes y niveles se 'congelan' en el historial. Aunque después se ajuste la clasificación de una pregunta, los meses anteriores no se modifican: la historia del clima queda preservada tal como se calculó en su momento."
            />
          </ul>
        </Card>

        <Card title="Un ejemplo concreto">
          <p className="text-sm text-ink-700 mb-3">
            Supongamos que el departamento de <strong>Finanzas</strong> recibió{' '}
            <strong>20 respuestas</strong> durante el mes.
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-ink-700">
            <li>De esas 20 personas, 18 terminaron con un puntaje personal de 40 o menos → quedan clasificadas en <strong>estado negativo</strong>.</li>
            <li>Las otras 2 obtuvieron entre 41 y 60 → quedan en <strong>estado neutro</strong>.</li>
            <li>El sistema calcula: 18 personas en estado negativo de 20 totales = <strong>90% del personal en estado negativo</strong>.</li>
            <li>
              Como ese porcentaje alcanza el 90%, el departamento queda en nivel{' '}
              <NivelPill nivel="NEGRO" /> — lo que activa la recomendación de visita inmediata
              por parte de Cultura y Gente.
            </li>
          </ol>
          <div className="mt-4 p-3 bg-ink-100 rounded text-xs text-ink-600">
            En cambio, si Finanzas hubiese recibido solo <strong>4 respuestas</strong> ese mes,
            el sistema <strong>no</strong> publicaría ningún nivel — aunque las 4 fueran negativas.
            La regla de anonimato pesa más que la urgencia del dato.
          </div>
        </Card>

        <Card title="¿Por qué un termómetro y no un semáforo?">
          <p className="text-sm text-ink-700">
            Un semáforo tiene solo tres luces y comunica una decisión rápida de "pase o pare".
            El clima organizacional es más matizado: necesitamos distinguir entre una situación
            estable, una zona de atención, un riesgo alto y una crisis que requiere intervención
            inmediata. Por eso usamos la imagen del <strong>termómetro</strong>: es un instrumento
            de medición que admite varios grados y refleja mejor que el clima de un equipo
            <em> sube o baja</em> en el tiempo.
          </p>
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
