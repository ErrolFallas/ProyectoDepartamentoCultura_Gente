import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useApi } from '../hooks/useApi.js';
import { PageHeader } from '../components/common/PageHeader.jsx';
import { Card } from '../components/common/Card.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { ChatMessage } from '../components/assistant/ChatMessage.jsx';
import { SuggestionPills } from '../components/assistant/SuggestionPills.jsx';

export function AssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const { data: capabilities } = useApi(() => api.assistantCapabilities(), []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, enviando]);

  async function enviar(texto) {
    const limpio = (texto ?? input).trim();
    if (!limpio || enviando) return;

    setError(null);
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
          latenciaMs: resp.latenciaMs
        }
      ]);
    } catch (e) {
      setError(e.message ?? 'Error al consultar el asistente');
    } finally {
      setEnviando(false);
      inputRef.current?.focus();
    }
  }

  async function reintentar() {
    // Reusar el último mensaje del usuario sin duplicarlo en la lista.
    if (enviando) return;
    setError(null);
    await consultarIA(messages);
  }

  function nuevaConversacion() {
    setMessages([]);
    setError(null);
  }

  const sinClave = capabilities && !capabilities.configurado;
  const chatVacio = messages.length === 0;

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

      <Card className="mb-4 !p-0 overflow-hidden">
        <div
          ref={scrollRef}
          className="min-h-[460px] max-h-[60vh] overflow-y-auto p-4 space-y-4 bg-ink-50/40"
        >
          {chatVacio ? (
            <EstadoVacio onPick={enviar} disabled={enviando || sinClave} />
          ) : (
            messages.map((m, i) => <ChatMessage key={i} message={m} />)
          )}

          {enviando && (
            <div className="flex items-center gap-3 text-ink-500 px-2">
              <Spinner />
              <span className="text-xs">La IA está consultando la base de datos…</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-semaforo-rojo/10 border border-semaforo-rojo/30 px-3 py-2 text-sm text-semaforo-rojo">
              <div className="font-medium mb-1">No se pudo obtener respuesta</div>
              <div className="opacity-90 mb-2">{error}</div>
              {messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                <button
                  onClick={reintentar}
                  disabled={enviando}
                  className="text-xs underline hover:no-underline disabled:opacity-50"
                >
                  Reintentar la última pregunta
                </button>
              )}
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
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              sinClave
                ? 'IA no configurada'
                : 'Escriba su pregunta en lenguaje natural, por ejemplo: ¿qué empresa tiene más alertas?'
            }
            disabled={enviando || sinClave}
            className="input flex-1"
            autoFocus
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={enviando || sinClave || !input.trim()}
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

function EstadoVacio({ onPick, disabled }) {
  return (
    <div className="py-6 px-1 space-y-5">
      <div className="text-center px-6">
        <div className="text-3xl mb-2 text-brand-600">✦</div>
        <div className="text-lg font-semibold text-ink-800">
          ¿En qué puedo ayudarle hoy?
        </div>
        <div className="text-xs text-ink-500 max-w-xl mx-auto mt-1">
          Pregunte en lenguaje natural sobre el estado del semáforo, comparativas entre
          empresas o tendencias por departamento. Seleccione cualquier sugerencia para empezar.
        </div>
      </div>
      <SuggestionPills onPick={onPick} disabled={disabled} />
    </div>
  );
}
