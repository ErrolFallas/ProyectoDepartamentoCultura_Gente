import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { ScopeSelector } from '../components/common/ScopeSelector.jsx';
import { PeriodPicker } from '../components/common/PeriodPicker.jsx';
import { currentPeriodMonth } from '../lib/format.js';

export function PresentationPage() {
  const [scope, setScope] = useState('COMPANY');
  const [scopeId, setScopeId] = useState(null);
  const [periodo, setPeriodo] = useState(currentPeriodMonth());

  return (
    <>
      <PageHeader
        title="Generador de presentación"
        description="Configurá empresa/departamento y período. La generación .pptx editable se entrega en la Fase 6 con PptxGenJS."
        actions={
          <span className="pill bg-ink-100 text-ink-600">Fase 6 — próximamente</span>
        }
      />

      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <label className="block">
            <span className="label">Alcance</span>
            <select className="input" value={scope} onChange={(e) => { setScope(e.target.value); setScopeId(null); }}>
              <option value="COMPANY">Empresa</option>
              <option value="DEPARTMENT">Departamento</option>
            </select>
          </label>
          <ScopeSelector scope={scope} value={scopeId} onChange={(id) => setScopeId(id)} />
          <PeriodPicker value={periodo} onChange={setPeriodo} />
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 text-sm text-ink-500">
          <div className="inline-flex items-center gap-2 rounded-full bg-ink-100 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-ink-400" />
            Vista previa pendiente
          </div>
          <button className="btn-primary" disabled>
            Generar .pptx (Fase 6)
          </button>
          <p className="max-w-md text-center text-xs">
            La salida será un .pptx editable basado en la plantilla maestra del
            informe de clima existente, con bloques por dimensión, mejores y
            peores resultados, y temas detectados por Gemini en texto abierto.
          </p>
        </div>
      </Card>
    </>
  );
}
