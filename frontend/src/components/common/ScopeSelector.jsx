import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

/**
 * Selector de entidad (empresa o departamento) usado por varios paneles.
 * Cuando scope = DEPARTMENT muestra dos selects (empresa → departamento)
 * y la cuadrícula interna ocupa el ancho disponible.
 *
 * Props:
 *  - scope: 'COMPANY' | 'DEPARTMENT'
 *  - value: número o null
 *  - onChange: (id, meta) => void
 *  - label: rótulo del select principal
 *  - className: clases adicionales (útil para `lg:col-span-2` en
 *    cuadrículas externas, manteniendo alineación con los otros inputs)
 */
export function ScopeSelector({
  scope,
  value,
  onChange,
  empresaIdInicial = null,
  label,
  className = ''
}) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(empresaIdInicial);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    api.listCompanies().then((r) => setCompanies(r.items)).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (scope !== 'DEPARTMENT' || !companyId) { setDepartments([]); return; }
    api.listDepartments(companyId).then((r) => setDepartments(r.items)).catch(() => setDepartments([]));
  }, [scope, companyId]);

  if (scope === 'COMPANY') {
    return (
      <label className={`block ${className}`}>
        <span className="label">{label ?? 'Empresa'}</span>
        <select
          className="input"
          value={value ?? ''}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            const meta = companies.find((c) => c.id === id) ?? null;
            onChange(id, meta);
          }}
        >
          <option value="">— Seleccionar empresa —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </label>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <label className="block min-w-0">
        <span className="label">Empresa</span>
        <select
          className="input"
          value={companyId ?? ''}
          onChange={(e) => {
            setCompanyId(e.target.value ? Number(e.target.value) : null);
            onChange(null, null);
          }}
        >
          <option value="">— Seleccionar —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </label>
      <label className="block min-w-0">
        <span className="label">{label ?? 'Departamento'}</span>
        <select
          className="input"
          value={value ?? ''}
          disabled={!companyId}
          onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null;
            const meta = departments.find((d) => d.id === id) ?? null;
            onChange(id, meta);
          }}
        >
          <option value="">— Seleccionar —</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </label>
    </div>
  );
}
