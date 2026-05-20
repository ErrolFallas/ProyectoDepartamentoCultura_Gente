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
import { StatBadge } from '../components/common/StatBadge.jsx';
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

  const rows = (resultado?.items ?? []).map((item) => {
    const meta = selecciones.find((s) => s.id === item.scope_id)?.meta;
    return {
      ...item,
      label: meta?.nombre ?? `ID ${item.scope_id}`,
      pct_positivo: item.pct_positivo ?? 0,
      pct_neutro: item.pct_neutro ?? 0,
      pct_negativo: item.pct_negativo ?? 0
    };
  });

  return (
    <>
      <PageHeader
        title="Comparador"
        description="Compará hasta 3 empresas o departamentos lado a lado, en el mismo período."
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <label className="block">
            <span className="label">Modo</span>
            <select
              className="input"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setSelecciones([{ id: null, meta: null }, { id: null, meta: null }, { id: null, meta: null }]);
                setResultado(null);
              }}
            >
              <option value="COMPANY">Empresas</option>
              <option value="DEPARTMENT">Departamentos</option>
            </select>
          </label>
          {selecciones.map((sel, i) => (
            <ScopeSelector
              key={i}
              scope={scope}
              value={sel.id}
              label={`Opción ${i + 1}`}
              onChange={(id, meta) => updateSeleccion(i, id, meta)}
            />
          ))}
          <PeriodPicker value={periodo} onChange={setPeriodo} />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="text-xs text-ink-500">
            {idsSeleccionados.length}/{MAX_COMPARAR} seleccionados
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
              <StatBadge
                key={i}
                label={r.label}
                value={r.anonimato_protegido ? '—' : pct(r.pct_positivo)}
                hint={r.anonimato_protegido
                  ? `Anonimato protegido (n=${r.n_respuestas}, mínimo ${r.umbral})`
                  : `${r.n_respuestas} respuestas`}
                tone={r.anonimato_protegido ? 'neutral'
                  : r.pct_negativo >= 75 ? 'danger'
                  : r.pct_negativo >= 40 ? 'warning' : 'positive'}
              />
            ))}
          </div>

          <Card title="Distribución de sentimientos" subtitle="Apilado 100% por entidad">
            <SentimentBars rows={rows.filter((r) => !r.anonimato_protegido)} />
          </Card>

          {ranking?.items?.length > 0 && (
            <Card title="Posición global en el ranking" className="mt-6">
              <RankingTable items={ranking.items} highlightIds={idsSeleccionados} scope={scope} />
            </Card>
          )}
        </>
      )}

      {!loading && !resultado && (
        <EmptyState
          title="Seleccioná entidades para comparar"
          description="Elegí hasta 3 empresas o departamentos y presioná Comparar."
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
            <th className="py-2">#</th>
            <th className="py-2">{scope === 'COMPANY' ? 'Empresa' : 'Departamento'}</th>
            {scope === 'DEPARTMENT' && <th className="py-2">Empresa</th>}
            <th className="py-2 text-right">% Positivo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const destacado = highlightIds.includes(i.scope_id);
            return (
              <tr key={i.scope_id} className={`border-b border-ink-100 last:border-0 ${destacado ? 'bg-brand-50' : ''}`}>
                <td className="py-2 font-medium text-ink-800">{i.posicion}</td>
                <td className="py-2">{scope === 'COMPANY' ? i.empresa : i.departamento}</td>
                {scope === 'DEPARTMENT' && <td className="py-2 text-ink-500">{i.empresa}</td>}
                <td className="py-2 text-right font-medium">{pct(i.valor)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
