import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { ErrorBox } from '../components/common/ErrorBox.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { NivelPill } from '../components/common/NivelPill.jsx';
import { PeriodPicker } from '../components/common/PeriodPicker.jsx';
import { pct, currentPeriodMonth, dateShort } from '../lib/format.js';

export function AlertsPage() {
  const [periodo, setPeriodo] = useState(currentPeriodMonth());
  const [nivel, setNivel] = useState('');
  const [atendida, setAtendida] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { data, error, loading, reload } = useApi(
    () => api.listAlerts({
      periodo,
      nivel: nivel || undefined,
      atendida: atendida || undefined
    }),
    [periodo, nivel, atendida]
  );

  async function recalcular() {
    setBusy(true);
    setFeedback(null);
    try {
      const r = await api.recalculateAlerts(periodo);
      setFeedback(`Semáforo recalculado: ${r.evaluados} evaluados (${r.niveles.ROJO} rojo, ${r.niveles.AMARILLO} amarillo, ${r.niveles.VERDE} verde, ${r.omitidos} omitidos por anonimato).`);
      reload();
    } catch (e) {
      setFeedback(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function atender(id) {
    const notas = window.prompt('Notas de la visita / atención (opcional):') ?? '';
    try {
      await api.atenderAlerta(id, notas);
      reload();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Semáforo de alertas"
        description="Departamentos ordenados por % de respuestas negativas. Respeta el umbral mínimo de respuestas para no exponer individuos."
        actions={
          <button onClick={recalcular} className="btn-secondary" disabled={busy}>
            {busy ? 'Recalculando…' : 'Recalcular semáforo'}
          </button>
        }
      />

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <PeriodPicker value={periodo} onChange={setPeriodo} />
          <label className="block">
            <span className="label">Nivel</span>
            <select className="input" value={nivel} onChange={(e) => setNivel(e.target.value)}>
              <option value="">Todos</option>
              <option value="ROJO">Rojo</option>
              <option value="AMARILLO">Amarillo</option>
              <option value="VERDE">Verde</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Atendida</span>
            <select className="input" value={atendida} onChange={(e) => setAtendida(e.target.value)}>
              <option value="">Todas</option>
              <option value="false">Pendientes</option>
              <option value="true">Atendidas</option>
            </select>
          </label>
        </div>
        {feedback && (
          <div className="mt-3 text-xs text-ink-600 bg-ink-100 rounded p-2">{feedback}</div>
        )}
      </Card>

      {loading && <Spinner label="Cargando alertas…" />}
      <ErrorBox error={error} onRetry={reload} />

      {data && (data.items.length ? (
        <Card title={`${data.items.length} departamento(s)`}>
          <AlertTable items={data.items} onAtender={atender} />
        </Card>
      ) : (
        <EmptyState
          title="Sin alertas para los filtros actuales"
          description="Si esperabas ver alertas, presioná Recalcular semáforo para reprocesar el período."
        />
      ))}
    </>
  );
}

function AlertTable({ items, onAtender }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-ink-500 border-b border-ink-200">
            <th className="py-2">Nivel</th>
            <th className="py-2">Departamento</th>
            <th className="py-2">Empresa</th>
            <th className="py-2 text-right">% Negativo</th>
            <th className="py-2">Atendida</th>
            <th className="py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-b border-ink-100 last:border-0">
              <td className="py-2"><NivelPill nivel={a.nivel} /></td>
              <td className="py-2 font-medium text-ink-800">{a.departamento}</td>
              <td className="py-2 text-ink-500">{a.empresa}</td>
              <td className="py-2 text-right font-medium">{pct(a.pct_negativo, 1)}</td>
              <td className="py-2 text-xs">
                {a.atendida
                  ? <span className="text-semaforo-verde">Sí · {dateShort(a.atendida_at)}</span>
                  : <span className="text-ink-400">No</span>}
              </td>
              <td className="py-2 text-right">
                {!a.atendida && (
                  <button onClick={() => onAtender(a.id)} className="btn-secondary text-xs">
                    Marcar atendida
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
