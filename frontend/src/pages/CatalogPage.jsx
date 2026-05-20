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
        title="Catálogo de preguntas"
        description="Bandeja de polaridad sugerida por Gemini. RRHH confirma o corrige; las respuestas en espera se reprocesan automáticamente."
      />

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
          title="Bandeja vacía"
          description="No hay preguntas pendientes de revisión. ¡Buen trabajo!"
        />
      ))}
    </>
  );
}

function ClassificationCard({ item, busy, onDecidir }) {
  const sugerida = item.polaridad_sugerida;
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs uppercase text-ink-500 tracking-wide mb-1">
            Pregunta · {item.dimension_sugerida ?? 'sin dimensión'}
          </div>
          <div className="text-base font-medium text-ink-900">{item.texto_pregunta}</div>
          <div className="mt-3 text-xs text-ink-600">
            Gemini sugiere <strong>{sugerida}</strong>
            {item.confianza !== null && <> ({pct(Number(item.confianza) * 100, 0)} confianza)</>}
            {item.razon && <em className="block text-ink-500 mt-1">"{item.razon}"</em>}
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
