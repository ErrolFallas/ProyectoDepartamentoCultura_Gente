import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Inicio', icon: '◇', end: true, hint: 'Resumen del período actual' },
  { to: '/asistente', label: 'Asistente IA', icon: '✦', hint: 'Consultas en lenguaje natural' },
  { to: '/comparador', label: 'Comparador', icon: '⇆', hint: 'Comparativa entre entidades' },
  { to: '/termometro', label: 'Termómetro de clima', icon: '◉', hint: 'Departamentos por nivel de atención' },
  { to: '/tendencias', label: 'Tendencias', icon: '⤴', hint: 'Evolución mensual y cronicidad' },
  { to: '/catalogo', label: 'Catálogo', icon: '☷', hint: 'Revisión de polaridad sugerida' },
  { to: '/presentacion', label: 'Presentación', icon: '▤', hint: 'Generar informe .pptx editable' },
  { to: '/metodologia', label: 'Metodología', icon: 'ⓘ', hint: 'Cómo se calcula cada nivel' }
];

export function Sidebar({ onCollapse }) {
  return (
    <aside className="w-60 shrink-0 bg-ink-900 text-ink-100 flex flex-col">
      <div className="px-5 py-5 border-b border-white/5 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold tracking-tight">Garnier PulseWork</div>
          <div className="text-[11px] text-ink-400">Cultura y Gente</div>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="Ocultar menú lateral"
            aria-label="Ocultar menú lateral"
            className="text-ink-300 hover:text-white transition px-2 py-1 rounded hover:bg-white/10"
          >
            ◀
          </button>
        )}
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
              <span className="block">{item.label}</span>
              <span className="block text-[11px] text-ink-400">{item.hint}</span>
            </span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-3 text-[11px] text-ink-500 border-t border-white/5">
        Información anónima · v1.0
      </div>
    </aside>
  );
}

/**
 * Pestaña flotante que aparece cuando el sidebar está oculto.
 * Diseñada para ser discreta: semitransparente, anclada a la izquierda
 * y separada del borde superior para no superponerse con el Topbar.
 */
export function SidebarShowTab({ onShow }) {
  return (
    <button
      onClick={onShow}
      title="Mostrar menú lateral"
      aria-label="Mostrar menú lateral"
      className="fixed left-0 top-24 z-30 bg-ink-900/40 hover:bg-ink-900/80 text-white
                 backdrop-blur-sm rounded-r-lg px-2 py-3 transition shadow
                 opacity-70 hover:opacity-100"
    >
      <span className="block text-base leading-none">▶</span>
      <span className="block text-[9px] uppercase tracking-wider mt-1 [writing-mode:vertical-rl]">
        Menú
      </span>
    </button>
  );
}
