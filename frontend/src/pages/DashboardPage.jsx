import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { Card } from '../components/common/Card.jsx';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { ErrorBox } from '../components/common/ErrorBox.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { StatBadge } from '../components/common/StatBadge.jsx';
import { NivelPill } from '../components/common/NivelPill.jsx';
import { pct } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi(() => api.focos(), []);

  return (
    <>
      <PageHeader
        title={`Bienvenido(a), ${user?.nombre?.split(' ')[0] ?? ''}`}
        description="Resumen del período actual: departamentos cuyo porcentaje de personal con tono negativo activó el semáforo. Esta vista permite identificar a qué equipos priorizar para una visita del área de Cultura y Gente."
        actions={
          <button onClick={reload} className="btn-secondary">Actualizar</button>
        }
      />

      {loading && <Spinner label="Buscando focos…" />}
      <ErrorBox error={error} onRetry={reload} />

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <StatBadge
              label="Período evaluado"
              value={data.periodo}
              hint="Mes en curso (YYYY-MM)"
              tone="info"
            />
            <StatBadge
              label="Departamentos en rojo"
              value={data.rojos.length}
              tone={data.rojos.length ? 'danger' : 'positive'}
              hint="≥ 75% del personal con tono negativo · requieren visita"
            />
            <StatBadge
              label="Departamentos en amarillo"
              value={data.amarillos.length}
              tone={data.amarillos.length ? 'warning' : 'positive'}
              hint="≥ 40% del personal con tono negativo · zona de observación"
            />
          </div>

          <Card
            title="Departamentos que requieren visita"
            subtitle="Cada fila es un departamento (👥) y la empresa a la que pertenece (🏢). Ordenado por urgencia."
          >
            <FocosList items={[...data.rojos, ...data.amarillos]} />
          </Card>
        </>
      )}
    </>
  );
}

function FocosList({ items }) {
  if (!items.length) {
    return (
      <EmptyState
        title="Ningún foco activo"
        description="Todos los departamentos están en verde para este período. No hay nadie por encima del umbral de % negativo."
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
          <Link to="/semaforo" className="btn-secondary text-xs">Detalle</Link>
        </li>
      ))}
    </ul>
  );
}
