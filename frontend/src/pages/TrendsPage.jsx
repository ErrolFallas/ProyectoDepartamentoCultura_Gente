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
  const [tipoGrafico, setTipoGrafico] = useState('linea');
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
        className="mb-3"
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
          <PeriodPicker
            value={periodo}
            onChange={setPeriodo}
            label="Período (día de la semana)"
            title="Solo aplica al gráfico de distribución por día de la semana"
            hint='Mes que se analiza para el panel "¿En qué día…?"'
          />
          <label className="block">
            <span className="label" title="Solo aplica al gráfico de evolución mensual y a la cronicidad">
              Histórico (evolución)
            </span>
            <select className="input" value={lookback} onChange={(e) => setLookback(Number(e.target.value))}>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
              <option value={24}>Últimos 24 meses</option>
            </select>
            <span className="block text-[10px] text-ink-500 mt-1">
              Cantidad de meses cerrados para la línea temporal y cronicidad
            </span>
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
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <StatBadge
                  label="Nivel actual del termómetro"
                  value={<NivelPill nivel={cronicidad.nivelActual} />}
                  hint={meta
                    ? `${scope === 'COMPANY' ? 'Empresa' : 'Departamento'}: ${meta.nombre}`
                    : '—'}
                />
                <StatBadge
                  label="Racha de alerta sin volver a verde"
                  value={`${cronicidad.meses} ${cronicidad.meses === 1 ? 'mes' : 'meses'}`}
                  tone={cronicidad.cronica ? 'danger' : cronicidad.meses ? 'warning' : 'positive'}
                  hint={cronicidad.cronica
                    ? 'Crónico (3 meses o más sin volver a verde) — intervención de fondo'
                    : cronicidad.meses
                      ? 'Alerta puntual — observación recomendada'
                      : 'Sin meses recientes fuera de verde'}
                />
                <StatBadge
                  label="Snapshots consultados"
                  value={historia.length}
                  hint={`Meses cerrados en los últimos ${lookback}`}
                />
              </div>
              <Card
                title="Racha mes a mes"
                subtitle={
                  <>
                    Cada bolita es un mes cerrado (del más antiguo al más reciente). El número de la
                    tarjeta "Racha de alerta" cuenta cuántos meses al final no volvieron a{' '}
                    <span className="font-semibold text-semaforo-verde">VERDE</span>; el contador se
                    reinicia apenas aparece un mes verde.
                  </>
                }
                className="mb-6"
              >
                <RachaMensual historia={historia} />
              </Card>
            </>
          )}

          <Card
            title="Evolución mensual del clima"
            subtitle="% positivo (verde) y % negativo (rojo) por mes cerrado. Cada punto/barra es un snapshot inmutable. Controlado por el parámetro Histórico."
            action={
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink-500 uppercase tracking-wider">Visualización</span>
                <select
                  className="text-xs border border-ink-300 rounded-md px-2 py-1 bg-white"
                  value={tipoGrafico}
                  onChange={(e) => setTipoGrafico(e.target.value)}
                >
                  <option value="linea">Línea</option>
                  <option value="area">Área</option>
                  <option value="barras">Barras agrupadas</option>
                  <option value="apiladas">Barras apiladas (pos/neu/neg)</option>
                </select>
              </div>
            }
          >
            {historia.length
              ? <TrendLine rows={historia} tipo={tipoGrafico} />
              : <EmptyState
                  title="Sin snapshots cerrados para esta entidad"
                  description="Los snapshots se crean al cerrar el mes. Podés disparar el cierre desde el script seed:aggregates o esperar al cron de fin de mes en n8n."
                />}
          </Card>

          {diaSemana && !diaSemana.anonimato_protegido && (
            <Card
              title="¿En qué día se concentran las emociones negativas?"
              subtitle={`Distribución del período ${periodo} (controlado por el campo "Período" arriba). Útil para detectar fenómenos tipo "lunes blues".`}
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

const UMBRALES = { NEGRO: 90, ROJO: 75, AMARILLO: 40 };

function clasificarNivel(pctNeg) {
  const v = Number(pctNeg);
  if (v >= UMBRALES.NEGRO) return 'NEGRO';
  if (v >= UMBRALES.ROJO) return 'ROJO';
  if (v >= UMBRALES.AMARILLO) return 'AMARILLO';
  return 'VERDE';
}

const COLOR_BOLITA = {
  NEGRO: 'bg-semaforo-negro',
  ROJO: 'bg-semaforo-rojo',
  AMARILLO: 'bg-semaforo-amarillo',
  VERDE: 'bg-semaforo-verde'
};

/**
 * Visualizador de cronicidad: una fila de bolitas (una por mes) que ilustra
 * por qué el contador de "racha" da el número que da. Las del final son las
 * más recientes y son las que se cuentan hasta encontrar un VERDE.
 */
function RachaMensual({ historia }) {
  if (!historia.length) {
    return <div className="text-xs text-ink-500">Sin snapshots para graficar la racha.</div>;
  }

  // historia viene del más antiguo al más reciente. Calculamos qué bolitas
  // forman la racha actual (todas las del final que no son VERDE).
  const rev = [...historia].reverse();
  let rachaCount = 0;
  for (const snap of rev) {
    if (clasificarNivel(snap.pct_negativo) === 'VERDE') break;
    rachaCount += 1;
  }
  const firstStreakIdx = historia.length - rachaCount;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-1.5 mb-3">
        {historia.map((snap, idx) => {
          const nivel = clasificarNivel(snap.pct_negativo);
          const inStreak = idx >= firstStreakIdx;
          return (
            <div key={snap.periodo ?? idx} className="flex flex-col items-center">
              <span
                className={`block h-4 w-4 rounded-full ${COLOR_BOLITA[nivel]} ${
                  inStreak ? 'ring-2 ring-brand-500 ring-offset-1' : 'opacity-70'
                }`}
                title={`${snap.periodo} · ${nivel} · ${Number(snap.pct_negativo).toFixed(1)}% negativo`}
              />
              <span className="text-[9px] text-ink-500 mt-1 transform rotate-45 origin-top-left">
                {snap.periodo?.slice(2)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-ink-600">
        <Leyenda nivel="NEGRO" texto="Crisis (≥ 90%)" />
        <Leyenda nivel="ROJO" texto="Alto (75–89%)" />
        <Leyenda nivel="AMARILLO" texto="Medio (40–74%)" />
        <Leyenda nivel="VERDE" texto="Estable (< 40%)" />
        <span className="text-ink-400">·</span>
        <span className="text-ink-600">
          <span className="inline-block h-3 w-3 rounded-full bg-ink-200 ring-2 ring-brand-500 ring-offset-1 align-middle mr-1" />
          marcado = en racha actual
        </span>
      </div>
      <p className="mt-3 text-xs text-ink-500">
        El contador de la tarjeta cuenta cuántas bolitas del final no son verdes.
        Apenas aparece una verde (mirando hacia atrás desde el mes más reciente), la racha se rompe
        y el contador vuelve a cero.
      </p>
    </div>
  );
}

function Leyenda({ nivel, texto }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded-full ${COLOR_BOLITA[nivel]}`} />
      <span>{texto}</span>
    </span>
  );
}
