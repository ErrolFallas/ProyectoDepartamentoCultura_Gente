import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Asistente', icon: '◇', end: true, hint: 'Focos rojos del período' },
  { to: '/comparador', label: 'Comparador', icon: '⇆', hint: 'Hasta 3 empresas/depts' },
  { to: '/semaforo', label: 'Semáforo', icon: '◉', hint: 'Alertas por departamento' },
  { to: '/tendencias', label: 'Tendencias', icon: '⤴', hint: 'Histórico y cronicidad' },
  { to: '/catalogo', label: 'Catálogo', icon: '☷', hint: 'Polaridad de preguntas' },
  { to: '/presentacion', label: 'Presentación', icon: '▤', hint: 'Generar .pptx', badge: 'F6' }
];

export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 bg-ink-900 text-ink-100 flex flex-col">
      <div className="px-5 py-5 border-b border-white/5">
        <div className="text-sm font-semibold tracking-tight">Garnier PulseWork</div>
        <div className="text-[11px] text-ink-400">Cultura y Gente</div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isActive ? 'bg-brand-600 text-white' : 'text-ink-200 hover:bg-white/5'
              }`
            }
          >
            <span className="mt-0.5 text-base opacity-80">{item.icon}</span>
            <span className="flex-1">
              <span className="flex items-center gap-2">
                {item.label}
                {item.badge && (
                  <span className="text-[10px] uppercase bg-white/10 px-1.5 py-0.5 rounded">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="block text-[11px] text-ink-400">{item.hint}</span>
            </span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 text-[11px] text-ink-500 border-t border-white/5">
        Anonimato estructural · v1.0
      </div>
    </aside>
  );
}
