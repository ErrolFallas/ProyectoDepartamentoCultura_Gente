/**
 * Cliente para la API de Groq (OpenAI-compatible).
 *
 * Se usa como FALLBACK automático cuando Gemini agota su cuota gratuita
 * diaria o devuelve limit:0 para el modelo. Groq corre Llama 3.3 70B con
 * function calling y free tier muy generoso (~14k req/día, sin tarjeta).
 *
 * El formato de tools en Groq sigue el spec OpenAI: { type:'function',
 * function:{ name, description, parameters } } — distinto del shape de
 * Gemini { name, description, parameters }, pero los nombres y schemas
 * de parámetros son intercambiables.
 */

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/errors.js';
import { listarDeclaraciones, obtenerEjecutor } from './tools-catalog.js';

const FETCH_TIMEOUT_MS = 30000;
const MAX_TOOL_ITERATIONS = 6;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export function groqDisponible() {
  return Boolean(env.GROQ_API_KEY);
}

// ---------------------------------------------------------------------------
// Conversión de schemas: tipos en MAYÚSCULAS (Gemini) → minúsculas (JSON Schema)
// ---------------------------------------------------------------------------

function normalizarTipo(t) {
  if (!t) return t;
  const mapa = { STRING: 'string', INTEGER: 'integer', BOOLEAN: 'boolean', NUMBER: 'number', ARRAY: 'array', OBJECT: 'object' };
  return mapa[t] ?? String(t).toLowerCase();
}

function normalizarSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const out = { ...schema };
  if (out.type) out.type = normalizarTipo(out.type);
  if (out.properties && typeof out.properties === 'object') {
    out.properties = Object.fromEntries(
      Object.entries(out.properties).map(([k, v]) => [k, normalizarSchema(v)])
    );
  }
  if (out.items) out.items = normalizarSchema(out.items);
  return out;
}

function declaracionesParaGroq() {
  return listarDeclaraciones().map((d) => ({
    type: 'function',
    function: {
      name: d.name,
      description: d.description,
      parameters: normalizarSchema(d.parameters ?? { type: 'OBJECT', properties: {} })
    }
  }));
}

// ---------------------------------------------------------------------------
// Conversión historial nuestro → mensajes OpenAI
// ---------------------------------------------------------------------------

function convertirHistorialAOpenAI(messages, systemInstruction) {
  const out = [{ role: 'system', content: systemInstruction }];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content ?? '' });
    } else if (m.role === 'assistant') {
      if (m.toolCalls?.length) {
        out.push({
          role: 'assistant',
          content: m.content ?? '',
          tool_calls: m.toolCalls.map((tc, i) => ({
            id: `call_${i}_${tc.name}`,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) }
          }))
        });
        m.toolCalls.forEach((tc, i) => {
          out.push({
            role: 'tool',
            tool_call_id: `call_${i}_${tc.name}`,
            content: JSON.stringify(tc.result ?? {})
          });
        });
      } else if (m.content) {
        out.push({ role: 'assistant', content: m.content });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cliente principal con loop de tool calling
// ---------------------------------------------------------------------------

/**
 * Resuelve la pregunta usando Groq + el catálogo de tools del proyecto.
 *
 * @param {{ messages, systemInstruction }} params
 * @returns {{ respuesta, toolCalls[], modelo, latenciaMs }}
 */
export async function preguntarGroq({ messages, systemInstruction }) {
  if (!groqDisponible()) {
    throw new AppError(
      'No hay proveedor de IA disponible (Gemini agotado y Groq no configurado).',
      { status: 503, code: 'AI_NOT_CONFIGURED' }
    );
  }

  const inicio = Date.now();
  const conversacion = convertirHistorialAOpenAI(messages, systemInstruction);
  const tools = declaracionesParaGroq();
  const toolCallsAcumulados = [];

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter += 1) {
    const respuesta = await llamarGroq({ messages: conversacion, tools });
    const choice = respuesta?.choices?.[0];
    const mensajeIA = choice?.message;

    const llamadas = mensajeIA?.tool_calls ?? [];

    if (!llamadas.length) {
      const texto = (mensajeIA?.content ?? '').trim();
      return {
        respuesta: texto || 'No tengo una respuesta para esa consulta.',
        toolCalls: toolCallsAcumulados,
        modelo: `${env.GROQ_MODEL} (fallback Groq)`,
        latenciaMs: Date.now() - inicio
      };
    }

    // Registrar la solicitud de tools que hizo la IA.
    conversacion.push({
      role: 'assistant',
      content: mensajeIA.content ?? '',
      tool_calls: llamadas
    });

    // Ejecutar cada tool y devolverle los resultados.
    for (const lc of llamadas) {
      const nombre = lc.function?.name;
      let args = {};
      try {
        args = lc.function?.arguments ? JSON.parse(lc.function.arguments) : {};
      } catch {
        args = {};
      }
      const ejecutor = obtenerEjecutor(nombre);
      let resultado;
      if (!ejecutor) {
        resultado = { error: `Herramienta desconocida: ${nombre}` };
      } else {
        try {
          resultado = await ejecutor(args);
        } catch (err) {
          logger.warn({ err: err.message, tool: nombre }, 'Tool falló en Groq');
          resultado = { error: err.message ?? 'fallo al ejecutar la herramienta' };
        }
      }
      toolCallsAcumulados.push({ name: nombre, args, result: resultado });
      conversacion.push({
        role: 'tool',
        tool_call_id: lc.id,
        content: JSON.stringify(resultado)
      });
    }
  }

  throw new AppError(
    'El asistente (Groq) no pudo completar el análisis. Intente reformular su pregunta.',
    { status: 504, code: 'AI_LOOP_LIMIT' }
  );
}

// ---------------------------------------------------------------------------
// HTTP wrapper con timeout + manejo de errores
// ---------------------------------------------------------------------------

async function llamarGroq({ messages, tools, intento = 0 }) {
  const body = {
    model: env.GROQ_MODEL,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.2,
    max_tokens: 1500
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let resp;
  try {
    resp = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new AppError(
        'El asistente (Groq) está tardando más de lo habitual en responder. Por favor intente nuevamente.',
        { status: 504, code: 'AI_TIMEOUT' }
      );
    }
    throw new AppError(
      'No fue posible comunicarse con el asistente de respaldo en este momento.',
      { status: 502, code: 'AI_UNREACHABLE' }
    );
  }
  clearTimeout(timeout);

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    logger.warn({ status: resp.status, body: text.slice(0, 800) }, 'Groq respondió con error');

    if (resp.status === 429 && intento < 2) {
      const espera = 2000 * (intento + 1);
      await new Promise((r) => setTimeout(r, espera));
      return llamarGroq({ messages, tools, intento: intento + 1 });
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new AppError(
        'La clave de respaldo del asistente no es válida. Avise al administrador.',
        { status: 502, code: 'AI_UNAUTHORIZED' }
      );
    }
    throw new AppError(
      'El asistente de respaldo tuvo un inconveniente. Por favor reintente en unos segundos.',
      { status: 502, code: 'AI_ERROR' }
    );
  }

  return resp.json();
}
