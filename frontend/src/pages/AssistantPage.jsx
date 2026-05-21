import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { ChatMessage } from '../components/assistant/ChatMessage.jsx';
import { SuggestionPills } from '../components/assistant/SuggestionPills.jsx';
import { validarPregunta } from '../lib/assistantGuard.js';

export function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [cuota, setCuota] = useState(null);
  const [tiempoRestante, setTiempoRestante] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const { data: capabilities } = useApi(() => api.assistantCapabilities(), []);
  const { data: sugerencias, reload: reloadSugerencias } = useApi(() => api.assistantSuggestions(), []);

  useEffect(() => {
    api.assistantQuota().then(setCuota).catch(() => setCuota(null));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, enviando]);

  useEffect(() => {
    if (!cuota?.resetEn) return;
    const tick = () => setTiempoRestante(formatearCuentaRegresiva(cuota.resetEn));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [cuota?.resetEn]);

  async function enviar(texto) {
    const limpio = (texto ?? input).trim();
    if (!limpio || enviando) return;

    const validacion = validarPregunta(limpio);
    if (!validacion.allowed) {
      setAviso(validacion);
      setError(null);
      return;
    }

    if (cuota && cuota.restantes <= 0) {
      setAviso({
        allowed: false,
        motivo: 'Cuota diaria agotada',
        explicacion: `Llegó al límite de ${cuota.total} consultas hoy. Se renueva en ${tiempoRestante}.`
      });
      return;
    }

    setError(null);
    setAviso(null);
    const nuevoUsuario = { role: 'user', content: limpio };
    const nuevoHistorial = [...messages, nuevoUsuario];
    setMessages(nuevoHistorial);
    setInput('');
    await consultarIA(nuevoHistorial);
  }

  async function consultarIA(historial) {
    setEnviando(true);
    try {
      const resp = await api.assistantAsk(historial);
      setMessages([
        ...historial,
        {
          role: 'assistant',
          content: resp.respuesta,
          toolCalls: resp.toolCalls ?? [],
          modelo: resp.modelo,
          latenciaMs: resp.latenciaMs,
          desdeCache: resp.desdeCache ?? false,
          hitCount: resp.hitCount ?? null
        }
      ]);
      if (resp.cuota) setCuota(resp.cuota);
      // Refresca sugerencias para que las nuevas frecuentes aparezcan.
      reloadSugerencias();
    } catch (e) {
      setError({ msg: e.message ?? 'Error al consultar el asistente', code: e.code });
      if (e.code === 'ASSISTANT_QUOTA_EXCEEDED') {
        // Refresca el contador para mostrar 0.
        api.assistantQuota().then(setCuota).catch(() => {});
      }
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
    }
  }

  function cargarSugerenciaAlInput(texto) {
    setInput(texto);
    setAviso(null);
    setError(null);
    inputRef.current?.focus();
  }

  async function reintentar() {
    if (enviando) return;
    setError(null);
    await consultarIA(messages);
  }

  function nuevaConversacion() {
    setMessages([]);
    setError(null);
    setAviso(null);
  }

  const sinClave = capabilities && !capabilities.configurado;
  const sinCuota = cuota && cuota.restantes <= 0;
  const chatVacio = messages.length === 0;
  const inputDeshabilitado = enviando || sinClave || sinCuota;

  return (
    <>
      <PageHeader
        title="Asistente IA"
        description="Realice consultas en lenguaje natural sobre el clima organizacional. La IA decide qué información buscar en la base, le muestra exactamente qué datos consultó y nunca tiene acceso a respuestas individuales."
        actions={
          !chatVacio && (
            <button onClick={nuevaConversacion} className="btn-secondary">Nueva conversación</button>
          )
        }
      />

      {sinClave && (
        <Card title="Configuración requerida" className="mb-4">
          <p className="text-sm text-ink-700">
            Esta funcionalidad requiere una clave de Gemini configurada en el
            archivo <code className="bg-ink-100 px-1 rounded">.env</code> del backend
            (variable <code className="bg-ink-100 px-1 rounded">GEMINI_API_KEY</code>).
            Solicite la clave al administrador y reinicie el backend.
          </p>
        </Card>
      )}

      {cuota && (
        <CuotaBar cuota={cuota} tiempoRestante={tiempoRestante} />
      )}

      <Card className="mb-4 !p-0 overflow-hidden">
        <div
          ref={scrollRef}
          className="min-h-[460px] max-h-[60vh] overflow-y-auto p-4 space-y-4 bg-ink-50/40"
        >
          {chatVacio ? (
            <EstadoVacio
              sugerencias={sugerencias}
              onPick={cargarSugerenciaAlInput}
              disabled={inputDeshabilitado}
            />
          ) : (
            messages.map((m, i) => <ChatMessage key={i} message={m} />)
          )}

          {enviando && (
            <div className="flex items-center gap-3 text-ink-500 px-2">
              <Spinner />
              <span className="text-xs">La IA está consultando la base de datos…</span>
            </div>
          )}

          {aviso && !aviso.allowed && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-300 px-3 py-2 text-sm text-yellow-900">
              <div className="font-medium mb-1">🛡 Pregunta bloqueada por seguridad</div>
              <div className="text-xs mb-1"><span className="font-semibold">Motivo:</span> {aviso.motivo}</div>
              {aviso.explicacion && (
                <div className="text-xs opacity-90">{aviso.explicacion}</div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none">⚠</span>
                <div className="flex-1">
                  <div className="font-medium mb-1">{tituloError(error)}</div>
                  <div className="text-amber-800 text-[13px]">{humanizarError(error)}</div>
                  {cuota && (error.code === 'AI_SERVICE_RATE_LIMITED' || error.code === 'AI_SERVICE_UNAVAILABLE') && (
                    <div className="text-[11px] text-amber-700 mt-1">
                      Su cuota personal sigue intacta: <strong>{cuota.restantes} de {cuota.total}</strong> consultas restantes hoy.
                    </div>
                  )}
                  {messages.length > 0 && messages[messages.length - 1].role === 'user' && !sinCuota && error.code !== 'ASSISTANT_QUOTA_EXCEEDED' && (
                    <button
                      onClick={reintentar}
                      disabled={enviando}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline hover:no-underline disabled:opacity-50"
                    >
                      ↻ Reintentar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); enviar(); }}
          className="border-t border-ink-200 bg-white p-3 flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); if (aviso) setAviso(null); }}
            placeholder={
              sinClave
                ? 'IA no configurada'
                : sinCuota
                  ? `Cuota diaria agotada · se renueva en ${tiempoRestante}`
                  : 'Escriba su pregunta en lenguaje natural, por ejemplo: ¿qué empresa tiene más alertas?'
            }
            disabled={inputDeshabilitado}
            className="input flex-1"
            autoFocus
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={inputDeshabilitado || !input.trim()}
          >
            Enviar
          </button>
        </form>
      </Card>

      {capabilities && (
        <details className="mt-2">
          <summary className="text-xs text-ink-500 cursor-pointer hover:text-ink-700 select-none">
            Ver capacidades técnicas del asistente
            <span className="text-ink-400 ml-1">
              ({capabilities.cantidadHerramientas} consultas disponibles · modelo {capabilities.modelo})
            </span>
          </summary>
          <div className="mt-3 rounded-lg border border-ink-200 bg-white p-4">
            <p className="text-xs text-ink-600 mb-3">
              El asistente puede invocar las siguientes consultas internas para
              responder. Esta lista existe para auditoría; no necesita conocer
              estos nombres para usar el chat.
            </p>
            <ul className="text-xs text-ink-700 space-y-1 list-disc pl-5">
              {capabilities.herramientas.map((h) => (
                <li key={h.nombre}>
                  <span className="font-mono text-[10px] text-ink-500">{h.nombre}</span>
                  {' — '}
                  {h.descripcion.split('.')[0]}.
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </>
  );
}

function tituloError(error) {
  switch (error?.code) {
    case 'ASSISTANT_QUOTA_EXCEEDED':
      return 'Llegó al límite personal de consultas para hoy';
    case 'AI_SERVICE_RATE_LIMITED':
      return 'El servicio externo de IA está saturado en este momento';
    case 'AI_SERVICE_UNAVAILABLE':
      return 'El servicio de IA está temporalmente saturado';
    case 'AI_TIMEOUT':
      return 'El asistente tardó más de lo habitual';
    case 'AI_NOT_CONFIGURED':
      return 'Asistente no disponible';
    case 'AI_LOOP_LIMIT':
      return 'La pregunta es demasiado amplia';
    default:
      return 'El asistente no pudo responder esta vez';
  }
}

function humanizarError(error) {
  const msg = error?.msg ?? error;
  if (!msg) return 'Por favor intente nuevamente en unos segundos.';
  const lower = String(msg).toLowerCase();
  // Si el backend ya devolvió un mensaje humano, lo usamos tal cual.
  if (/(reintente|intente|disponible|límite|tardando|inconveniente|momento|mantenimiento|cuota|capacidad)/i.test(msg) &&
      !/\b(error|http|gemini|api|jwt|sql|exception|stack)\b/i.test(msg)) {
    return msg;
  }
  // Mensajes crudos quedan disimulados por uno amable.
  if (lower.includes('502') || lower.includes('503') || lower.includes('504') || lower.includes('puerta')) {
    return 'El servicio de IA tuvo un inconveniente momentáneo. Por favor reintente en unos segundos; suele resolverse solo.';
  }
  if (lower.includes('429') || lower.includes('demasiadas')) {
    return 'El asistente está recibiendo muchas consultas en este momento. Espere alrededor de un minuto y vuelva a intentarlo.';
  }
  if (lower.includes('timeout') || lower.includes('tiempo')) {
    return 'La consulta está tardando más de lo habitual. Reintente en unos segundos.';
  }
  return 'Algo no salió como esperábamos. Por favor reintente en unos segundos; si persiste, contacte al administrador.';
}

function CuotaBar({ cuota, tiempoRestante }) {
  const { usadas, restantes, total } = cuota;
  const pct = total > 0 ? Math.min(100, (usadas / total) * 100) : 0;
  const tone = restantes === 0
    ? 'bg-semaforo-rojo'
    : restantes <= Math.max(2, Math.floor(total * 0.2))
      ? 'bg-semaforo-amarillo'
      : 'bg-brand-600';

  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="text-xs text-ink-600">
          Consultas al asistente: <span className="font-semibold text-ink-900">{usadas}</span> de{' '}
          <span className="font-semibold text-ink-900">{total}</span> usadas hoy ·{' '}
          <span className={`font-semibold ${restantes === 0 ? 'text-semaforo-rojo' : 'text-ink-900'}`}>
            {restantes} {restantes === 1 ? 'restante' : 'restantes'}
          </span>
        </div>
        <div className="text-[11px] text-ink-500">
          Se renueva en <span className="font-medium text-ink-700">{tiempoRestante || '—'}</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatearCuentaRegresiva(isoReset) {
  const reset = new Date(isoReset).getTime();
  const ahora = Date.now();
  const ms = Math.max(0, reset - ahora);
  if (ms === 0) return '0 m';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} h ${m} m`;
  return `${m} m`;
}

function EstadoVacio({ sugerencias, onPick, disabled }) {
  return (
    <div className="py-6 px-1 space-y-5">
      <div className="text-center px-6">
        <div className="text-3xl mb-2 text-brand-600">✦</div>
        <div className="text-lg font-semibold text-ink-800">
          ¿En qué puedo ayudarle hoy?
        </div>
        <div className="text-xs text-ink-500 max-w-xl mx-auto mt-1">
          Pregunte en lenguaje natural sobre el estado del termómetro de clima, comparativas entre
          empresas o tendencias por departamento. Las sugerencias se cargan al cuadro de texto para que pueda editarlas.
        </div>
      </div>
      <SuggestionPills data={sugerencias} onPick={onPick} disabled={disabled} />
    </div>
  );
}
