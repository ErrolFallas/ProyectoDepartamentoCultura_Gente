import { useState } from 'react';
import { api } from '../lib/api.js';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { ErrorBox } from '../components/common/ErrorBox.jsx';
import { ScopeSelector } from '../components/common/ScopeSelector.jsx';
import { PeriodPicker } from '../components/common/PeriodPicker.jsx';
import { StatBadge } from '../components/common/StatBadge.jsx';
import { NivelPill } from '../components/common/NivelPill.jsx';
import { EntityLabel } from '../components/common/EntityLabel.jsx';
import { pct, currentPeriodMonth } from '../lib/format.js';

export function PresentationPage() {
  const [scope, setScope] = useState('COMPANY');
  const [scopeId, setScopeId] = useState(null);
  const [meta, setMeta] = useState(null);
  const [periodo, setPeriodo] = useState(currentPeriodMonth());
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  async function loadPreview() {
    if (!scopeId) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const data = await api.presentationPreview({ scope, scope_id: scopeId, periodo });
      setPreview(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }

  async function descargar() {
    if (!scopeId) return;
    setDownloading(true);
    setFeedback(null);
    setError(null);
    try {
      const { blob, filename } = await api.presentationDownload({ scope, scope_id: scopeId, periodo });
      triggerDownload(blob, filename);
      setFeedback(`Descargado: ${filename}`);
    } catch (e) {
      setError(e);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Generador de presentación"
        description="Crea un informe .pptx editable con los resultados del período seleccionado. Está pensado para que Cultura y Gente pueda corregir o quitar contenido al instante en PowerPoint antes de presentarlo."
      />

      <Card title="1. Definir alcance del informe" subtitle="Elegí sobre qué entidad y qué período se generará el .pptx" className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-start">
          <label className="block">
            <span className="label">Tipo de informe</span>
            <select
              className="input"
              value={scope}
              onChange={(e) => { setScope(e.target.value); setScopeId(null); setMeta(null); setPreview(null); }}
            >
              <option value="COMPANY">Empresa (consolidado)</option>
              <option value="DEPARTMENT">Departamento (equipo)</option>
            </select>
          </label>
          <ScopeSelector
            scope={scope}
            value={scopeId}
            onChange={(id, m) => { setScopeId(id); setMeta(m); setPreview(null); }}
            label={scope === 'COMPANY' ? 'Empresa a informar' : 'Departamento a informar'}
            className="lg:col-span-2"
          />
          <PeriodPicker value={periodo} onChange={(v) => { setPeriodo(v); setPreview(null); }} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-ink-500">
            {meta
              ? <>Se generará el informe de <EntityLabel scope={scope} nombre={meta.nombre} empresa={meta.empresa} variant="compact" /></>
              : 'Aún no se ha seleccionado empresa ni departamento.'}
          </div>
          <button onClick={loadPreview} className="btn-secondary" disabled={!scopeId || loading}>
            {loading ? 'Cargando…' : 'Ver vista previa'}
          </button>
        </div>
      </Card>

      <ErrorBox error={error} onRetry={loadPreview} />

      {preview && (
        <Card
          title="2. Vista previa del informe"
          subtitle="Estos son los bloques que se incluirán en el .pptx"
          className="mb-6"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatBadge
              label={preview.meta.tipo === 'EMPRESA' ? 'Empresa a informar' : 'Departamento a informar'}
              value={preview.meta.nombre}
              hint={preview.meta.tipo === 'DEPARTAMENTO'
                ? `Pertenece a la empresa ${preview.meta.empresa?.nombre ?? '—'}`
                : 'Consolidado de toda la empresa'}
              tone="info"
            />
            <StatBadge
              label="Personal positivo"
              value={pct(preview.agregado.pct_positivo)}
              hint={`${preview.agregado.n_respuestas} respuestas anónimas`}
              tone="positive"
            />
            <StatBadge
              label="Personal negativo"
              value={pct(preview.agregado.pct_negativo)}
              hint="≥ 75% ROJO · ≥ 90% NEGRO (crisis)"
              tone={preview.agregado.pct_negativo >= 75 ? 'danger'
                : preview.agregado.pct_negativo >= 40 ? 'warning' : 'positive'}
            />
            <StatBadge
              label="Posición en ranking"
              value={preview.posicionRanking ? `#${preview.posicionRanking.posicion}` : '—'}
              hint={preview.posicionRanking
                ? `de ${preview.posicionRanking.totalEnRanking} ${scope === 'COMPANY' ? 'empresas' : 'departamentos'}`
                : 'Sin datos suficientes'}
              tone="neutral"
            />
          </div>

          <div className="rounded-lg border border-ink-200 bg-white divide-y divide-ink-100">
            <RowResumen
              label="Nivel del termómetro"
              value={<NivelPill nivel={preview.nivelSemaforo.nivel} />}
              hint={`Calculado a partir de ${pct(preview.nivelSemaforo.pct_negativo)} negativo`}
            />
            <RowResumen
              label="Bloques por dimensión"
              value={`${preview.cantidadDimensiones} dimensiones`}
              hint={`Total ${preview.cantidadPreguntas} preguntas confirmadas con datos`}
            />
            <RowResumen
              label="Mejores resultados"
              value={`${preview.cantidadMejores} preguntas destacadas`}
              hint="Las cinco con mayor % positivo"
            />
            <RowResumen
              label="Áreas de mejora"
              value={`${preview.cantidadPeores} preguntas críticas`}
              hint="Las cinco con mayor % negativo"
            />
            <RowResumen
              label="Temas detectados por IA"
              value={preview.cantidadTemas
                ? `${preview.cantidadTemas} temas recurrentes`
                : 'Sin temas (no hay respuestas de texto abierto)'}
              hint={preview.respuestasAbiertasAnalizadas
                ? `${preview.respuestasAbiertasAnalizadas} respuestas abiertas analizadas`
                : 'La IA solo procesa preguntas con escala "Abierta"'}
            />
          </div>
        </Card>
      )}

      <Card
        title="3. Descargar"
        subtitle="El archivo es un .pptx editable: permite ajustar branding, ocultar contenido sensible o agregar comentarios antes de la presentación."
      >
        {feedback && (
          <div className="mb-3 text-sm bg-semaforo-verde/10 text-semaforo-verde px-3 py-2 rounded">
            {feedback}
          </div>
        )}
        <div className="flex flex-col items-center gap-2 py-6">
          <button
            onClick={descargar}
            className="btn-primary"
            disabled={!scopeId || downloading}
          >
            {downloading ? 'Generando…' : 'Generar y descargar .pptx'}
          </button>
          <p className="text-[11px] text-ink-500 text-center max-w-md">
            Los departamentos por debajo del umbral mínimo de respuestas se omiten
            automáticamente del informe para proteger el anonimato.
          </p>
        </div>
        {downloading && (
          <div className="mt-3"><Spinner label="Construyendo láminas y empaquetando…" /></div>
        )}
      </Card>
    </>
  );
}

function RowResumen({ label, value, hint }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-3 py-2.5 items-start">
      <div className="text-sm font-medium text-ink-700">{label}</div>
      <div className="text-sm text-ink-900">{value}</div>
      <div className="text-xs text-ink-500">{hint}</div>
    </div>
  );
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
