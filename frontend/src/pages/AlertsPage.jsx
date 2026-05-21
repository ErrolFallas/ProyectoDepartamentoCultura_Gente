import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
  pedirDatosDeAtencion,
  confirmarEdicionConPalabraClave,
  confirmarDesmarcar,
  verDetalleAtencion,
  toastExito,
  alertaError
} from '../lib/sweetAlertConfig.js';

const UMBRAL_ESTABLE = 0.1;  // <0.1% se considera estable y no requiere acción

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
      const niv = r.niveles ?? {};
      setFeedback(
        `Termómetro recalculado: ${r.evaluados} evaluados (` +
        `${niv.NEGRO ?? 0} negro, ${niv.ROJO ?? 0} rojo, ${niv.AMARILLO ?? 0} amarillo, ${niv.VERDE ?? 0} verde, ` +
        `${r.omitidos} omitidos por anonimato).`
      );
      reload();
    } catch (e) {
      setFeedback(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function atender(alerta) {
    const datos = await pedirDatosDeAtencion({
      departamento: alerta.departamento,
      empresa: alerta.empresa,
      nivel: alerta.nivel,
      pctNegativo: alerta.pct_negativo
    });
    if (!datos) return;  // canceló en algún paso

    try {
      await api.atenderAlerta(alerta.id, datos);
      toastExito(`Atención registrada para ${alerta.departamento}`);
      reload();
    } catch (e) {
      await alertaError(e.message ?? 'Ocurrió un problema al guardar la atención. Intente de nuevo.');
    }
  }

  async function editarAtencion(alerta) {
    const ok = await confirmarEdicionConPalabraClave();
    if (!ok) return;

    const datos = await pedirDatosDeAtencion({
      departamento: alerta.departamento,
      empresa: alerta.empresa,
      nivel: alerta.nivel,
      pctNegativo: alerta.pct_negativo
    });
    if (!datos) return;

    try {
      await api.atenderAlerta(alerta.id, datos);
      toastExito(`Información de atención actualizada para ${alerta.departamento}`);
      reload();
    } catch (e) {
      await alertaError(e.message ?? 'Ocurrió un problema al actualizar la atención.');
    }
  }

  async function verDetalle(alerta) {
    try {
      const detalle = await api.detalleAlerta(alerta.id);
      const accion = await verDetalleAtencion(detalle);
      if (accion === 'editar') {
        await editarAtencion(alerta);
      } else if (accion === 'desmarcar') {
        await desmarcarAtencion(alerta);
      }
    } catch (e) {
      await alertaError(e.message ?? 'No se pudo cargar el detalle.');
    }
  }

  async function desmarcarAtencion(alerta) {
    const fechaPrevia = alerta.atendida_at
      ? dateShort(alerta.atendida_at)
      : null;
    const result = await confirmarDesmarcar({
      departamento: alerta.departamento,
      fechaPrevia
    });
    if (!result) return;

    try {
      await api.desmarcarAlerta(alerta.id, result.motivo);
      toastExito(`${alerta.departamento} vuelve a aparecer como pendiente`);
      reload();
    } catch (e) {
      await alertaError(e.message ?? 'No se pudo revertir la atención.');
    }
  }

  return (
    <>
      <PageHeader
        title="Termómetro de clima por departamento"
        description={
          <>
            Cada fila representa un equipo (👥) y su empresa (🏢). El nivel se calcula a partir del % de personal con tono negativo:{' '}
            <span className="font-medium text-semaforo-verde">VERDE</span> (&lt; 40%),{' '}
            <span className="font-medium text-yellow-700">AMARILLO</span> (40–74%),{' '}
            <span className="font-medium text-semaforo-rojo">ROJO</span> (75–89%),{' '}
            <span className="font-medium text-ink-900">NEGRO</span> (≥ 90% → crisis).{' '}
            Departamentos con muy pocas respuestas se omiten para proteger el anonimato.{' '}
            <Link to="/metodologia" className="text-brand-600 hover:underline">¿Cómo se calcula? Ver metodología →</Link>
          </>
        }
        actions={
          <button onClick={recalcular} className="btn-secondary" disabled={busy}>
            {busy ? 'Recalculando…' : 'Recalcular termómetro'}
          </button>
        }
      />

      <Card title="Filtros" subtitle="Acotá la lista por período, nivel y estado de atención." className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <PeriodPicker value={periodo} onChange={setPeriodo} />
          <label className="block">
            <span className="label">Nivel del termómetro</span>
            <select className="input" value={nivel} onChange={(e) => setNivel(e.target.value)}>
              <option value="">Todos los niveles</option>
              <option value="NEGRO">Solo NEGRO (crisis · visita inmediata)</option>
              <option value="ROJO">Solo ROJO (intervención urgente)</option>
              <option value="AMARILLO">Solo AMARILLO (observación)</option>
              <option value="VERDE">Solo VERDE (estable)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Estado de atención</span>
            <select className="input" value={atendida} onChange={(e) => setAtendida(e.target.value)}>
              <option value="">Todas las alertas</option>
              <option value="false">Pendientes de visita</option>
              <option value="true">Ya atendidas por Cultura y Gente</option>
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
        <Card
          title={`${data.items.length} departamento(s) en la lista`}
          subtitle="Cada departamento (👥) aparece con su empresa (🏢), su nivel de alerta y el % de personal con tono negativo."
        >
          <AlertTable
            items={data.items}
            onAtender={atender}
            onVerDetalle={verDetalle}
          />
        </Card>
      ) : (
        <EmptyState
          title="Sin alertas para los filtros actuales"
          description="Si esperaba ver alertas, oprima Recalcular termómetro para reprocesar el período seleccionado."
        />
      ))}
    </>
  );
}

function AlertTable({ items, onAtender, onVerDetalle }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-ink-500 border-b border-ink-200">
            <th className="py-2">Nivel</th>
            <th className="py-2">👥 Departamento</th>
            <th className="py-2">🏢 Empresa</th>
            <th className="py-2 text-right">% Personal negativo</th>
            <th className="py-2">Estado</th>
            <th className="py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const estable = Number(a.pct_negativo) < UMBRAL_ESTABLE;
            return (
              <tr key={a.id} className="border-b border-ink-100 last:border-0">
                <td className="py-2"><NivelPill nivel={a.nivel} /></td>
                <td className="py-2 font-medium text-ink-800">{a.departamento}</td>
                <td className="py-2 text-ink-500">{a.empresa}</td>
                <td className="py-2 text-right font-medium">{pct(a.pct_negativo, 1)}</td>
                <td className="py-2 text-xs">
                  {estable ? (
                    <span className="text-semaforo-verde">✓ Estable</span>
                  ) : a.atendida ? (
                    <span className="text-semaforo-verde">
                      ✓ Atendida el {dateShort(a.atendida_at)}
                    </span>
                  ) : (
                    <span className="text-ink-400">Pendiente</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {estable ? (
                    <span className="text-[11px] text-ink-400 italic">No requiere atención</span>
                  ) : a.atendida ? (
                    <button onClick={() => onVerDetalle(a)} className="btn-secondary text-xs">
                      Ver / editar detalles
                    </button>
                  ) : (
                    <button onClick={() => onAtender(a)} className="btn-primary text-xs">
                      Marcar como atendida
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
