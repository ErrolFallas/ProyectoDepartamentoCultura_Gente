import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { Card } from '../components/common/Card.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { ErrorBox } from '../components/common/ErrorBox.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { NivelPill } from '../components/common/NivelPill.jsx';
import { pct } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';

const NIVEL_ORDEN = { NEGRO: 0, ROJO: 1, AMARILLO: 2, VERDE: 3 };

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(() => api.focos(), []);

  const negros = data?.negros ?? [];
  const rojos = data?.rojos ?? [];
  const amarillos = data?.amarillos ?? [];
  const focosUrgentes = [...negros, ...rojos].sort(
    (a, b) => (NIVEL_ORDEN[a.nivel] - NIVEL_ORDEN[b.nivel]) || (b.pct_negativo - a.pct_negativo)
  );

  return (
    <>
      <PageHeader
        title={`Bienvenido(a), ${user?.nombre?.split(' ')[0] ?? ''}`}
        description={
          <>
            Resumen del período actual. Las tarjetas de abajo cuentan los departamentos en cada nivel
            del termómetro de clima. La lista muestra los focos que requieren visita (NEGRO y ROJO),
            ordenados por urgencia.{' '}
            <Link to="/metodologia" className="text-brand-600 hover:underline">¿Cómo se calcula? →</Link>
          </>
        }
        actions={<button onClick={reload} className="btn-secondary">Actualizar</button>}
      />

      {loading && <Spinner label="Buscando focos…" />}
      <ErrorBox error={error} onRetry={reload} />

      {data && (
        <>
          <div className="mb-2 text-xs text-ink-500">
            Período evaluado: <span className="font-semibold text-ink-700">{data.periodo}</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <ResumenCard
              tone="negro"
              titulo="NEGRO"
              subtitulo="Crisis · visita inmediata"
              valor={negros.length}
              hint="≥ 90% personal negativo"
            />
            <ResumenCard
              tone="rojo"
              titulo="ROJO"
              subtitulo="Visita prioritaria"
              valor={rojos.length}
              hint="75% – 89% personal negativo"
            />
            <ResumenCard
              tone="amarillo"
              titulo="AMARILLO"
              subtitulo="Zona de observación"
              valor={amarillos.length}
              hint="40% – 74% personal negativo"
            />
            <ResumenCard
              tone="verde"
              titulo="ESTABLES"
              subtitulo="Sin acción requerida"
              valor={data.totalDeptos != null ? Math.max(0, data.totalDeptos - data.total) : null}
              hint={data.totalDeptos != null
                ? `de ${data.totalDeptos} departamentos evaluados`
                : 'cálculo no disponible'}
            />
          </div>

          <Card
            title="Departamentos que requieren visita"
            subtitle="Lista combinada NEGRO + ROJO, ordenada por urgencia. Cada fila es un departamento (👥) y su empresa (🏢)."
          >
            <FocosList items={focosUrgentes} fallbackTitle="Ningún foco crítico" />
          </Card>

          {amarillos.length > 0 && (
            <Card
              title="Zona de observación (AMARILLO)"
              subtitle="No requieren visita inmediata pero conviene monitorearlos y compararlos contra el mes anterior."
              className="mt-6"
            >
              <FocosList items={amarillos} fallbackTitle="Sin amarillos" />
            </Card>
          )}
        </>
      )}
    </>
  );
}

function ResumenCard({ tone, titulo, subtitulo, valor, hint }) {
  const tones = {
    negro: 'bg-semaforo-negro text-white',
    rojo: 'bg-semaforo-rojo text-white',
    amarillo: 'bg-semaforo-amarillo text-ink-900',
    verde: 'bg-semaforo-verde text-white'
  };
  return (
    <div className={`rounded-xl p-4 ${tones[tone]} shadow-sm`}>
      <div className="text-[11px] uppercase tracking-wider font-bold opacity-90">{titulo}</div>
      <div className="text-3xl font-bold leading-none mt-2">{valor ?? '—'}</div>
      <div className="text-xs mt-1 opacity-90">{subtitulo}</div>
      <div className="text-[10px] mt-2 opacity-75">{hint}</div>
    </div>
  );
}

function FocosList({ items, fallbackTitle }) {
  if (!items.length) {
    return (
      <EmptyState
        title={fallbackTitle ?? 'Sin focos activos'}
        description="No hay departamentos en este nivel para el período actual."
      />
    );
  }
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((a) => (
        <li key={a.id} className="py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="pill bg-ink-100 text-ink-600 text-[10px]">Departamento</span>
              <span className="font-semibold text-ink-900">👥 {a.departamento}</span>
              <NivelPill nivel={a.nivel} />
            </div>
            <div className="text-xs text-ink-500 mt-0.5">
              de la empresa <span className="font-medium text-ink-700">🏢 {a.empresa}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-ink-900">{pct(a.pct_negativo, 1)}</div>
            <div className="text-[11px] text-ink-500">del personal con tono negativo</div>
          </div>
          <Link to="/termometro" className="btn-secondary text-xs">Detalle</Link>
        </li>
      ))}
    </ul>
  );
}
