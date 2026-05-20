import { useState } from 'react';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { ErrorBox } from '../components/common/ErrorBox.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { ScopeSelector } from '../components/common/ScopeSelector.jsx';
import { PeriodPicker } from '../components/common/PeriodPicker.jsx';
import { TrendLine } from '../components/charts/TrendLine.jsx';
import { DayBars } from '../components/charts/DayBars.jsx';
import { StatBadge } from '../components/common/StatBadge.jsx';
import { NivelPill } from '../components/common/NivelPill.jsx';
import { EntityLabel } from '../components/common/EntityLabel.jsx';
import { pct, currentPeriodMonth } from '../lib/format.js';

export function TrendsPage() {
  const [scope, setScope] = useState('DEPARTMENT');
  const [scopeId, setScopeId] = useState(null);
  const [meta, setMeta] = useState(null);
  const [periodo, setPeriodo] = useState(currentPeriodMonth());
  const [lookback, setLookback] = useState(12);
  const [historia, setHistoria] = useState(null);
  const [diaSemana, setDiaSemana] = useState(null);
  const [cronicidad, setCronicidad] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function consultar() {
    if (!scopeId) return;
    setLoading(true);
    setError(null);
    setHistoria(null);
    setDiaSemana(null);
    setCronicidad(null);
    try {
      const [h, dow, cron] = await Promise.all([
        api.snapshotsHistory({ scope, scope_id: scopeId, lookback_months: lookback }),
        api.dayOfWeek({ scope, scope_id: scopeId, periodo }),
        api.cronicidad({ scope, scope_id: scopeId, lookback_months: lookback })
      ]);
      setHistoria(h.items ?? []);
      setDiaSemana(dow);
      setCronicidad(cron);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Tendencias e histórico"
        description="Visualice la evolución mensual del clima a partir de los snapshots inmutables, identifique en qué día de la semana se concentran las emociones negativas, y verifique si una alerta es puntual o crónica (tres meses consecutivos o más)."
      />

      <Card
        title="Parámetros del análisis"
        subtitle="Seleccione la entidad y el rango temporal. La opción Empresa consolida resultados de toda la organización; la opción Departamento muestra los de un equipo específico."
        className="mb-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-start">
          <label className="block">
            <span className="label">Tipo de entidad</span>
            <select
              className="input"
              value={scope}
              onChange={(e) => { setScope(e.target.value); setScopeId(null); setMeta(null); }}
            >
              <option value="COMPANY">Empresa</option>
              <option value="DEPARTMENT">Departamento</option>
            </select>
          </label>
          <ScopeSelector
            scope={scope}
            value={scopeId}
            onChange={(id, m) => { setScopeId(id); setMeta(m); }}
            label={scope === 'COMPANY' ? 'Empresa a analizar' : 'Departamento a analizar'}
            className="lg:col-span-2"
          />
          <PeriodPicker value={periodo} onChange={setPeriodo} />
          <label className="block">
            <span className="label">Histórico</span>
            <select className="input" value={lookback} onChange={(e) => setLookback(Number(e.target.value))}>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
              <option value={24}>Últimos 24 meses</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          {meta && (
            <div className="text-xs text-ink-600">
              Analizando:&nbsp;
              <EntityLabel
                scope={scope}
                nombre={meta.nombre}
                empresa={meta.empresa ?? null}
                variant="compact"
              />
            </div>
          )}
          <button onClick={consultar} className="btn-primary" disabled={!scopeId || loading}>
            {loading ? 'Consultando…' : 'Consultar'}
          </button>
        </div>
      </Card>

      <ErrorBox error={error} onRetry={consultar} />
      {loading && <Spinner label="Cargando snapshots…" />}

      {!loading && historia && (
        <>
          {cronicidad && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <StatBadge
                label="Nivel actual del semáforo"
                value={<NivelPill nivel={cronicidad.nivelActual} />}
                hint={meta
                  ? `${scope === 'COMPANY' ? 'Empresa' : 'Departamento'}: ${meta.nombre}`
                  : '—'}
              />
              <StatBadge
                label="Meses consecutivos en alerta"
                value={cronicidad.meses}
                tone={cronicidad.cronica ? 'danger' : cronicidad.meses ? 'warning' : 'positive'}
                hint={cronicidad.cronica
                  ? 'Situación crónica (tres meses o más) — se recomienda intervención de fondo'
                  : cronicidad.meses
                    ? 'Alerta puntual — se recomienda observación'
                    : 'Sin meses recientes en alerta'}
              />
              <StatBadge
                label="Snapshots consultados"
                value={historia.length}
                hint={`Meses cerrados en los últimos ${lookback}`}
              />
            </div>
          )}

          <Card
            title="Evolución mensual del clima"
            subtitle="Línea verde = % positivo del período · Línea roja = % negativo. Cada punto es un snapshot inmutable de un mes cerrado."
          >
            {historia.length
              ? <TrendLine rows={historia} />
              : <EmptyState
                  title="Sin snapshots cerrados para esta entidad"
                  description="Los snapshots se crean al cerrar el mes. Podés disparar el cierre desde el script seed:aggregates o esperar al cron de fin de mes en n8n."
                />}
          </Card>

          {diaSemana && !diaSemana.anonimato_protegido && (
            <Card
              title="¿En qué día se concentran las emociones negativas?"
              subtitle={`Distribución del período ${periodo}. Útil para detectar fenómenos tipo "lunes blues".`}
              className="mt-6"
            >
              <DayBars rows={diaSemana.items} />
            </Card>
          )}

          {diaSemana?.anonimato_protegido && (
            <Card title="Distribución por día de la semana" className="mt-6">
              <EmptyState
                title="Anonimato protegido"
                description={`Solo ${diaSemana.n_respuestas} respuestas en el período (mínimo ${diaSemana.umbral}). No se desglosa para no exponer individuos.`}
              />
            </Card>
          )}
        </>
      )}

      {!loading && !historia && (
        <EmptyState
          title="Seleccione una empresa o departamento"
          description="Tras realizar la selección y oprimir Consultar, aparecerán la evolución mensual, la distribución por día de la semana y el indicador de cronicidad."
        />
      )}
    </>
  );
}
