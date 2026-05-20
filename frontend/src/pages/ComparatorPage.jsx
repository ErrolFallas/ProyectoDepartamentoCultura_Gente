import { useState } from 'react';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { ErrorBox } from '../components/common/ErrorBox.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { ScopeSelector } from '../components/common/ScopeSelector.jsx';
import { PeriodPicker } from '../components/common/PeriodPicker.jsx';
import { SentimentBars } from '../components/charts/SentimentBars.jsx';
import { pct, currentPeriodMonth } from '../lib/format.js';

const MAX_COMPARAR = 3;

export function ComparatorPage() {
  const [scope, setScope] = useState('COMPANY');
  const [periodo, setPeriodo] = useState(currentPeriodMonth());
  const [selecciones, setSelecciones] = useState([
    { id: null, meta: null },
    { id: null, meta: null },
    { id: null, meta: null }
  ]);
  const [resultado, setResultado] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const idsSeleccionados = selecciones.filter((s) => s.id).map((s) => s.id);

  function updateSeleccion(idx, id, meta) {
    setSelecciones((prev) => prev.map((s, i) => (i === idx ? { id, meta } : s)));
  }

  async function comparar() {
    if (!idsSeleccionados.length) return;
    setLoading(true);
    setError(null);
    setResultado(null);
    setRanking(null);
    try {
      const [agg, rk] = await Promise.all([
        api.compare({ scope, scope_ids: idsSeleccionados, periodo }),
        api.getRanking({ tipo: 'GLOBAL', scope, periodo })
      ]);
      setResultado(agg);
      setRanking(rk);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  const tipoLabel = scope === 'COMPANY' ? 'empresa' : 'departamento';
  const tipoLabelPlural = scope === 'COMPANY' ? 'empresas' : 'departamentos';
  const tipoEmoji = scope === 'COMPANY' ? '🏢' : '👥';

  const rows = (resultado?.items ?? []).map((item) => {
    const meta = selecciones.find((s) => s.id === item.scope_id)?.meta;
    return {
      ...item,
      nombre: meta?.nombre ?? `ID ${item.scope_id}`,
      label: meta?.nombre ?? `ID ${item.scope_id}`,
      empresaPadre: typeof meta?.empresa === 'string' ? meta.empresa : meta?.empresa?.nombre,
      pct_positivo: item.pct_positivo ?? 0,
      pct_neutro: item.pct_neutro ?? 0,
      pct_negativo: item.pct_negativo ?? 0
    };
  });

  return (
    <>
      <PageHeader
        title="Comparador lado a lado"
        description={`Seleccione hasta tres ${tipoLabelPlural} para observar sus resultados de clima en el mismo período. Esta vista facilita identificar áreas de oportunidad y entender variaciones entre equipos.`}
      />

      <Card
        title="Parámetros de la comparación"
        subtitle="Defina el tipo de entidades a comparar (empresas o departamentos), seleccione hasta tres opciones y el período."
        className="mb-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start mb-3">
          <label className="block">
            <span className="label">Comparar entre</span>
            <select
              className="input"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setSelecciones([{ id: null, meta: null }, { id: null, meta: null }, { id: null, meta: null }]);
                setResultado(null);
              }}
            >
              <option value="COMPANY">Empresas (resultados globales)</option>
              <option value="DEPARTMENT">Departamentos (equipos)</option>
            </select>
          </label>
          <PeriodPicker value={periodo} onChange={setPeriodo} />
        </div>

        <div className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
          Hasta {MAX_COMPARAR} {tipoLabelPlural} para comparar
        </div>
        <div className={`grid gap-3 items-start ${
          scope === 'DEPARTMENT' ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'
        }`}>
          {selecciones.map((sel, i) => (
            <div key={i} className="rounded-lg border border-ink-100 p-3 bg-ink-50/50">
              <div className="text-[11px] font-semibold text-ink-500 mb-2">
                {scope === 'COMPANY' ? 'Empresa' : 'Departamento'} {i + 1}
              </div>
              <ScopeSelector
                scope={scope}
                value={sel.id}
                label={scope === 'COMPANY' ? 'Empresa' : 'Departamento'}
                onChange={(id, meta) => updateSeleccion(i, id, meta)}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <span className="text-xs text-ink-500">
            {idsSeleccionados.length} de {MAX_COMPARAR} {tipoLabelPlural} seleccionad{scope === 'COMPANY' ? 'as' : 'os'}
          </span>
          <button
            onClick={comparar}
            className="btn-primary"
            disabled={!idsSeleccionados.length || loading}
          >
            {loading ? 'Comparando…' : 'Comparar'}
          </button>
        </div>
      </Card>

      <ErrorBox error={error} onRetry={comparar} />
      {loading && <Spinner label="Calculando agregados…" />}

      {!loading && resultado && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {rows.map((r, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="pill bg-ink-100 text-ink-600 text-[10px]">
                    {scope === 'COMPANY' ? 'Empresa' : 'Departamento'}
                  </span>
                  <span className="text-base font-semibold text-ink-900">{tipoEmoji} {r.nombre}</span>
                </div>
                {scope === 'DEPARTMENT' && r.empresaPadre && (
                  <div className="text-[11px] text-ink-500 mb-2">de la empresa 🏢 {r.empresaPadre}</div>
                )}
                <div className={`text-2xl font-bold mt-1 ${
                  r.anonimato_protegido ? 'text-ink-400'
                    : r.pct_negativo >= 75 ? 'text-semaforo-rojo'
                    : r.pct_negativo >= 40 ? 'text-yellow-600' : 'text-semaforo-verde'
                }`}>
                  {r.anonimato_protegido ? '—' : pct(r.pct_positivo)}
                </div>
                <div className="text-[11px] text-ink-500">Personal con tono positivo</div>
                <div className="text-[11px] text-ink-500 mt-1">
                  {r.anonimato_protegido
                    ? `Anonimato protegido (solo ${r.n_respuestas} respuestas, mínimo ${r.umbral})`
                    : `${r.n_respuestas} respuestas anónimas en el período`}
                </div>
              </div>
            ))}
          </div>

          <Card
            title="Distribución de sentimientos por entidad"
            subtitle="Cada barra está apilada al 100% mostrando qué porcentaje del personal respondió en cada tono."
          >
            <SentimentBars rows={rows.filter((r) => !r.anonimato_protegido)} />
          </Card>

          {ranking?.items?.length > 0 && (
            <Card
              title={`Posición global de ${tipoLabelPlural} en el ranking`}
              subtitle={`Top-20 ordenado por % positivo del período. Tus selecciones aparecen resaltadas en azul.`}
              className="mt-6"
            >
              <RankingTable items={ranking.items} highlightIds={idsSeleccionados} scope={scope} />
            </Card>
          )}
        </>
      )}

      {!loading && !resultado && (
        <EmptyState
          title={`Seleccioná ${tipoLabelPlural} para comparar`}
          description={`Seleccione hasta 3 ${tipoLabelPlural} en los selectores superiores y oprima Comparar.`}
        />
      )}
    </>
  );
}

function RankingTable({ items, highlightIds, scope }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-ink-500 border-b border-ink-200">
            <th className="py-2">Posición</th>
            <th className="py-2">{scope === 'COMPANY' ? '🏢 Empresa' : '👥 Departamento'}</th>
            {scope === 'DEPARTMENT' && <th className="py-2">🏢 Empresa a la que pertenece</th>}
            <th className="py-2 text-right">% Personal positivo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const destacado = highlightIds.includes(i.scope_id);
            return (
              <tr key={i.scope_id} className={`border-b border-ink-100 last:border-0 ${destacado ? 'bg-brand-50' : ''}`}>
                <td className="py-2 font-semibold text-ink-800">#{i.posicion}</td>
                <td className="py-2 font-medium">{scope === 'COMPANY' ? i.empresa : i.departamento}</td>
                {scope === 'DEPARTMENT' && <td className="py-2 text-ink-500">{i.empresa}</td>}
                <td className="py-2 text-right font-semibold text-semaforo-verde">{pct(i.valor)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
