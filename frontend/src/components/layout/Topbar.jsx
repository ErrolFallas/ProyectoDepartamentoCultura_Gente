import { useAuth } from '../../context/AuthContext.jsx';

export function Topbar() {
  const { user, logout } = useAuth();
  const iniciales = user?.nombre?.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <header className="h-14 bg-white border-b border-ink-200 px-6 flex items-center justify-end gap-4">
      <div className="text-right">
        <div className="text-sm font-medium text-ink-800">{user?.nombre}</div>
        <div className="text-[11px] text-ink-500">{user?.email} · {user?.role}</div>
      </div>
      <div className="h-9 w-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold">
        {iniciales}
      </div>
      <button onClick={logout} className="text-sm text-ink-500 hover:text-ink-800 transition">
        Salir
      </button>
    </header>
  );
}
