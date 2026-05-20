import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

/**
 * Selector de entidad (empresa o departamento) usado por el Comparador
 * y otros paneles. Si scope = DEPARTMENT, primero filtra por empresa.
 *
 * Props:
 *  - scope: 'COMPANY' | 'DEPARTMENT'
 *  - value: número o null
 *  - onChange: (id, meta) => void
 *  - empresaIdInicial: si scope=DEPARTMENT, empresa a filtrar
 */
export function ScopeSelector({ scope, value, onChange, empresaIdInicial = null, label }) {
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
      <label className="block">
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
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className="label">Empresa</span>
        <select
          className="input"
          value={companyId ?? ''}
          onChange={(e) => {
            setCompanyId(e.target.value ? Number(e.target.value) : null);
            onChange(null, null);
          }}
        >
          <option value="">—</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </label>
      <label className="block">
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
          <option value="">—</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </label>
    </div>
  );
}
