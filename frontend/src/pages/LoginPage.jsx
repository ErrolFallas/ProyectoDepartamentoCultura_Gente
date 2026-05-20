import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname ?? '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(form.email.trim(), form.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ink-50">
      <aside className="hidden lg:flex flex-col justify-between bg-ink-900 text-white p-12">
        <div>
          <div className="text-sm uppercase tracking-widest text-ink-400">Departamento de</div>
          <div className="text-3xl font-semibold">Cultura y Gente</div>
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-2xl font-semibold">Garnier PulseWork</h2>
          <p className="text-ink-300 text-sm leading-relaxed">
            Plataforma de bienestar y clima organizacional. Procesa
            respuestas anónimas, identifica equipos que requieren atención y
            sugiere visitas a departamentos preservando siempre el anonimato
            del personal.
          </p>
          <ul className="text-xs text-ink-400 space-y-1">
            <li>· Anonimato estructural del personal</li>
            <li>· Polaridad de preguntas confirmada por una persona</li>
            <li>· Snapshots mensuales inmutables</li>
          </ul>
        </div>
        <div className="text-xs text-ink-500">v1.0 · Plan Maestro PulseWork</div>
      </aside>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8 space-y-4">
          <header>
            <h1 className="text-xl font-semibold">Iniciar sesión</h1>
            <p className="text-sm text-ink-500">Acceso exclusivo para el Departamento de Cultura y Gente</p>
          </header>

          <label className="block">
            <span className="label">Correo institucional</span>
            <input
              type="email"
              autoComplete="username"
              className="input"
              value={form.email}
              required
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>

          <label className="block">
            <span className="label">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              className="input"
              value={form.password}
              required
              minLength={6}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>

          {error && (
            <div className="rounded-lg bg-semaforo-rojo/10 px-3 py-2 text-xs text-semaforo-rojo">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Verificando…' : 'Entrar'}
          </button>

          <p className="text-[11px] text-ink-400 text-center">
            Si es su primer acceso, utilice las credenciales iniciales y
            solicite el cambio de contraseña al administrador.
          </p>
        </form>
      </section>
    </div>
  );
}
