import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { ErrorBox } from '../components/common/ErrorBox.jsx';
import { EmptyState } from '../components/common/EmptyState.jsx';
import { pct } from '../lib/format.js';

export function CatalogPage() {
  const { data, error, loading, reload } = useApi(() => api.getClassifications(), []);
  const [busyId, setBusyId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  async function decidir(item, polaridadFinal, accion) {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const r = await api.confirmClassification(item.id, {
        polaridad_final: polaridadFinal,
        accion
      });
      setFeedback(
        accion === 'RECHAZAR'
          ? `Pregunta rechazada (sigue en revisión).`
          : `Polaridad ${r.polaridad} aplicada. Reprocesadas ${r.reproceso.actualizadas} respuestas.`
      );
      reload();
    } catch (e) {
      setFeedback(`Error: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Catálogo de preguntas — Revisión de polaridad"
        description="Cuando llega una pregunta nueva desde la encuesta, la IA sugiere si la polaridad es DIRECTA (un número alto significa positivo) o INVERSA (alto significa negativo). Aquí Cultura y Gente confirma o corrige antes de que esa pregunta empiece a puntuar. Las respuestas a esa pregunta se mantienen en espera hasta que la confirmes."
      />

      <Card title="¿Qué se envía a la IA?" subtitle="Por transparencia y privacidad" className="mb-4">
        <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
          <li>Solo el <strong>texto de la pregunta</strong> y el tipo de escala (Likert, Frecuencia, etc.).</li>
          <li>Nunca se envía la empresa, el departamento ni respuestas concretas.</li>
          <li>La sugerencia es siempre revisable: el sistema no aplica polaridad sin confirmación humana.</li>
        </ul>
      </Card>

      {feedback && (
        <div className="mb-4 text-sm bg-brand-50 text-brand-700 px-3 py-2 rounded">{feedback}</div>
      )}

      {loading && <Spinner label="Cargando clasificaciones…" />}
      <ErrorBox error={error} onRetry={reload} />

      {data && (data.items.length ? (
        <div className="space-y-3">
          {data.items.map((item) => (
            <ClassificationCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onDecidir={decidir}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Bandeja sin pendientes"
          description="No hay preguntas pendientes de revisión en este momento."
        />
      ))}
    </>
  );
}

function ClassificationCard({ item, busy, onDecidir }) {
  const sugerida = item.polaridad_sugerida;
  const explicaPolaridad = {
    DIRECTA: 'Un número alto (ej. "Totalmente de acuerdo") indica emoción positiva.',
    INVERSA: 'Un número alto (ej. "Siempre") indica emoción negativa.',
    NEUTRA: 'Pregunta demográfica — no puntúa, solo segmenta.'
  };
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs uppercase text-ink-500 tracking-wide mb-1">
            Pregunta pendiente · dimensión sugerida: {item.dimension_sugerida ?? 'sin asignar'}
          </div>
          <div className="text-base font-medium text-ink-900">{item.texto_pregunta}</div>
          <div className="mt-3 text-xs text-ink-700 bg-ink-50 rounded p-2.5 border border-ink-100">
            <div>
              La <strong>IA</strong> sugiere polaridad{' '}
              <span className="pill bg-brand-50 text-brand-700">{sugerida}</span>
              {item.confianza !== null && (
                <span className="text-ink-500"> · {pct(Number(item.confianza) * 100, 0)} de confianza</span>
              )}
            </div>
            <div className="mt-1 text-ink-600">{explicaPolaridad[sugerida]}</div>
            {item.razon && <em className="block text-ink-500 mt-1">Razón aportada: "{item.razon}"</em>}
          </div>
        </div>

        <div className="flex flex-col gap-2 w-44">
          <ConfirmButton
            label="Confirmar sugerencia"
            tone="primary"
            busy={busy}
            onClick={() => onDecidir(item, sugerida, 'CONFIRMAR')}
          />
          <CorrectionMenu
            sugerida={sugerida}
            busy={busy}
            onPick={(p) => onDecidir(item, p, 'CORREGIR')}
          />
          <ConfirmButton
            label="Rechazar"
            tone="danger"
            busy={busy}
            onClick={() => onDecidir(item, sugerida, 'RECHAZAR')}
          />
        </div>
      </div>
    </Card>
  );
}

function ConfirmButton({ label, tone, busy, onClick }) {
  const cls = tone === 'danger' ? 'btn-danger' : tone === 'primary' ? 'btn-primary' : 'btn-secondary';
  return (
    <button className={cls} disabled={busy} onClick={onClick}>
      {busy ? '…' : label}
    </button>
  );
}

function CorrectionMenu({ sugerida, busy, onPick }) {
  const alternativas = ['DIRECTA', 'INVERSA', 'NEUTRA'].filter((p) => p !== sugerida);
  return (
    <details className="group">
      <summary className="btn-secondary cursor-pointer">Corregir…</summary>
      <div className="mt-2 flex flex-col gap-1">
        {alternativas.map((p) => (
          <button key={p} className="btn-secondary text-xs" disabled={busy} onClick={() => onPick(p)}>
            Marcar como {p}
          </button>
        ))}
      </div>
    </details>
  );
}
