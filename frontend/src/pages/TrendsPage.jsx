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
        description="Evolución mensual desde snapshots, distribución por día de la semana y cronicidad de alertas."
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="label">Modo</span>
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
          />
          <PeriodPicker value={periodo} onChange={setPeriodo} />
          <label className="block">
            <span className="label">Histórico (meses)</span>
            <select className="input" value={lookback} onChange={(e) => setLookback(Number(e.target.value))}>
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
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
                label="Nivel actual"
                value={<NivelPill nivel={cronicidad.nivelActual} />}
                hint={meta?.nombre ?? '—'}
              />
              <StatBadge
                label="Meses consecutivos en alerta"
                value={cronicidad.meses}
                tone={cronicidad.cronica ? 'danger' : cronicidad.meses ? 'warning' : 'positive'}
                hint={cronicidad.cronica ? 'Caso crónico (≥ 3 meses)' : 'Puntual'}
              />
              <StatBadge
                label="Snapshots consultados"
                value={historia.length}
                hint={`Últimos ${lookback} meses`}
              />
            </div>
          )}

          <Card title="Evolución mensual" subtitle="% positivo vs % negativo">
            {historia.length
              ? <TrendLine rows={historia} />
              : <EmptyState title="Sin snapshots para este alcance" description="Cerrá un mes con POST /api/snapshots/close." />}
          </Card>

          {diaSemana && !diaSemana.anonimato_protegido && (
            <Card title="Distribución por día de la semana" subtitle={`Período ${periodo}`} className="mt-6">
              <DayBars rows={diaSemana.items} />
            </Card>
          )}

          {diaSemana?.anonimato_protegido && (
            <Card title="Distribución por día de la semana" className="mt-6">
              <EmptyState
                title="Anonimato protegido"
                description={`Solo ${diaSemana.n_respuestas} respuestas (mínimo ${diaSemana.umbral}).`}
              />
            </Card>
          )}
        </>
      )}

      {!loading && !historia && (
        <EmptyState
          title="Seleccioná una empresa o departamento"
          description="Para ver evolución mensual y cronicidad."
        />
      )}
    </>
  );
}
