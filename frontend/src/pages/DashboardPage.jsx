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
        title={`Hola, ${user?.nombre?.split(' ')[0] ?? ''}`}
        description="Asistente de notificaciones: focos del período actual que requieren atención de Cultura y Gente."
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
              label="Período"
              value={data.periodo}
              hint="Mes en curso"
              tone="info"
            />
            <StatBadge
              label="Departamentos en rojo"
              value={data.rojos.length}
              tone={data.rojos.length ? 'danger' : 'positive'}
              hint="≥ 75% emociones negativas"
            />
            <StatBadge
              label="En observación (amarillo)"
              value={data.amarillos.length}
              tone={data.amarillos.length ? 'warning' : 'positive'}
              hint="≥ 40% negativas"
            />
          </div>

          <Card title="Departamentos que requieren visita" subtitle="Ordenados por urgencia">
            <FocosList items={[...data.rojos, ...data.amarillos]} />
          </Card>
        </>
      )}
    </>
  );
}

function FocosList({ items }) {
  if (!items.length) {
    return <EmptyState title="Ningún foco activo" description="Todos los departamentos están en verde para este período." />;
  }
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((a) => (
        <li key={a.id} className="py-3 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink-800">{a.departamento}</span>
              <NivelPill nivel={a.nivel} />
            </div>
            <div className="text-xs text-ink-500">{a.empresa}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-ink-900">{pct(a.pct_negativo, 1)}</div>
            <div className="text-[11px] text-ink-500">negativo</div>
          </div>
          <Link to="/semaforo" className="btn-secondary text-xs">Detalle</Link>
        </li>
      ))}
    </ul>
  );
}
