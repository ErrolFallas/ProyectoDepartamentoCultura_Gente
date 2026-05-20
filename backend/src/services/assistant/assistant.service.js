import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../utils/errors.js';
import { listarDeclaraciones, obtenerEjecutor } from './tools-catalog.js';

const MAX_TOOL_ITERATIONS = 6;
const FETCH_TIMEOUT_MS = 30000;

const SYSTEM_INSTRUCTION = `Eres el asistente analítico del Departamento de Cultura y Gente de Garnier.
Tu trabajo es responder preguntas sobre clima organizacional consultando
herramientas que devuelven datos reales y agregados de la base.

REGLAS DE EJECUCIÓN (críticas):
1. Si necesitas un dato para responder, LLAMA la herramienta inmediatamente.
   NUNCA describas en texto lo que vas a hacer ("voy a consultar…",
   "necesito el ID…"); simplemente invoca la herramienta sin anunciarlo.
2. Si necesitas resolver un nombre a un ID (empresa o departamento),
   encadena: primero listarEmpresas o listarDepartamentos, después la
   herramienta que necesitas. Hazlo en pasos sucesivos sin pedir permiso.
3. Si la pregunta requiere comparar todos los departamentos (p.ej.
   "¿hay algún departamento crónico?"), itera sobre los resultados de
   listarAlertas o usa listarDepartamentosCronicos.

REGLAS DE CONTENIDO:
- Nunca inventes números. Todos los datos provienen de herramientas.
- Responde siempre en español neutro y formal (usted/impersonal),
  apropiado para RRHH.
- Muestra porcentajes con 1 decimal y aclara el período.
- Si una respuesta tiene anonimato_protegido=true, explica que el
  departamento no se desglosa por tener pocas respuestas (sin inventar).
- Si la información no está disponible, dilo con honestidad.
- Tras consultar, redacta una respuesta concisa (máximo 3 párrafos),
  con 1-2 viñetas cuando ayude a destacar cifras clave.
- No reveles los IDs internos en la respuesta al usuario, salvo que
  los pida explícitamente.`;

/**
 * Entrada principal. Recibe el historial de mensajes y devuelve la
 * próxima respuesta del asistente.
 *
 * @param {Array<{role, content, toolCalls?}>} messages
 * @returns {{respuesta, toolCalls[], modelo, latenciaMs}}
 */
export async function preguntarAsistente({ messages }) {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      'El asistente requiere configurar GEMINI_API_KEY en el archivo .env para funcionar.',
      { status: 503, code: 'AI_NOT_CONFIGURED' }
    );
  }

  const inicio = Date.now();
  const contents = convertirHistorialAGemini(messages);
  const toolCallsAcumulados = [];

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter += 1) {
    const response = await callGemini({ contents });
    const cand = response?.candidates?.[0];
    const parts = cand?.content?.parts ?? [];

    // Recolectar todas las llamadas a herramientas (puede haber varias por turno).
    const llamadasDeEsteTurno = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

    if (!llamadasDeEsteTurno.length) {
      // No hay más llamadas; extraer el texto final.
      const texto = parts.map((p) => p.text ?? '').join('').trim();
      return {
        respuesta: texto || 'No tengo una respuesta para esa consulta.',
        toolCalls: toolCallsAcumulados,
        modelo: env.GEMINI_MODEL,
        latenciaMs: Date.now() - inicio
      };
    }

    // Ejecutar cada llamada y agregar los resultados al historial.
    contents.push({ role: 'model', parts });

    const responseParts = [];
    for (const llamada of llamadasDeEsteTurno) {
      const ejecutor = obtenerEjecutor(llamada.name);
      let resultado;
      if (!ejecutor) {
        resultado = { error: `Herramienta desconocida: ${llamada.name}` };
      } else {
        try {
          resultado = await ejecutor(llamada.args ?? {});
        } catch (err) {
          logger.warn({ err: err.message, tool: llamada.name }, 'Tool falló');
          resultado = { error: err.message ?? 'fallo al ejecutar la herramienta' };
        }
      }
      toolCallsAcumulados.push({
        name: llamada.name,
        args: llamada.args ?? {},
        result: resultado
      });
      responseParts.push({
        functionResponse: { name: llamada.name, response: resultado }
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  throw new AppError(
    'El asistente excedió el número máximo de pasos sin formular una respuesta. ' +
      'Intente reformular la pregunta de forma más específica.',
    { status: 504, code: 'AI_LOOP_LIMIT' }
  );
}

// ---------------------------------------------------------------------
// Conversión historial nuestro → estructura Gemini
// ---------------------------------------------------------------------

function convertirHistorialAGemini(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', parts: [{ text: m.content ?? '' }] });
    } else if (m.role === 'assistant') {
      // Si el mensaje del asistente tuvo llamadas a herramientas, las
      // incluimos primero (como model output) seguidas de sus respuestas.
      if (m.toolCalls?.length) {
        out.push({
          role: 'model',
          parts: m.toolCalls.map((tc) => ({
            functionCall: { name: tc.name, args: tc.args ?? {} }
          }))
        });
        out.push({
          role: 'user',
          parts: m.toolCalls.map((tc) => ({
            functionResponse: { name: tc.name, response: tc.result }
          }))
        });
      }
      if (m.content) {
        out.push({ role: 'model', parts: [{ text: m.content }] });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Cliente Gemini
// ---------------------------------------------------------------------

async function callGemini({ contents, intento = 0 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents,
    tools: [{ functionDeclarations: listarDeclaraciones() }],
    // AUTO permite al modelo decidir si llamar herramientas o responder;
    // combinado con el system instruction firme, evita que "anuncie"
    // consultas sin ejecutarlas.
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1500
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new AppError('La IA no respondió a tiempo. Reintente en un momento.', { status: 504, code: 'AI_TIMEOUT' });
    }
    throw new AppError(`No se pudo contactar a la IA: ${err.message}`, { status: 502, code: 'AI_UNREACHABLE' });
  }
  clearTimeout(timeout);

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    logger.warn({ status: resp.status, body: text.slice(0, 500) }, 'Gemini respondió con error');

    if (resp.status === 429) {
      // Reintento automático con espera exponencial cuando es probable
      // que sea cuota por minuto (no diaria). Máximo 2 reintentos.
      const tipoCuota = detectarTipoCuota(text);
      if (intento < 2 && tipoCuota !== 'DIA') {
        const esperaMs = 3000 * (intento + 1);
        logger.warn({ intento, esperaMs }, 'Reintentando tras 429');
        await new Promise((r) => setTimeout(r, esperaMs));
        return callGemini({ contents, intento: intento + 1 });
      }
      const mensaje =
        tipoCuota === 'DIA'
          ? 'Se agotó la cuota diaria del plan gratuito de Gemini para el modelo ' +
            `"${env.GEMINI_MODEL}". Opciones: esperar hasta mañana, cambiar a un ` +
            'modelo más liviano (GEMINI_MODEL=gemini-2.5-flash-lite tiene más cuota), ' +
            'o cambiar a un plan pagado en Google AI Studio.'
          : 'La IA recibió demasiadas consultas en poco tiempo. ' +
            'Espere alrededor de un minuto y reintente.';
      throw new AppError(mensaje, { status: 429, code: 'AI_RATE_LIMITED' });
    }
    if (resp.status === 403 || resp.status === 401) {
      throw new AppError(
        'La clave de Gemini configurada no es válida o no tiene permisos. ' +
          'Revise GEMINI_API_KEY en el archivo .env.',
        { status: 502, code: 'AI_UNAUTHORIZED' }
      );
    }
    if (resp.status === 404) {
      throw new AppError(
        `El modelo "${env.GEMINI_MODEL}" no está disponible en su cuenta. ` +
          'Cambie GEMINI_MODEL en .env por uno disponible (p.ej. gemini-2.5-flash).',
        { status: 502, code: 'AI_MODEL_NOT_FOUND' }
      );
    }
    throw new AppError(
      `La IA respondió con código ${resp.status}.`,
      { status: 502, code: 'AI_ERROR' }
    );
  }

  return resp.json();
}

function detectarTipoCuota(textoError) {
  if (!textoError) return null;
  const t = textoError.toLowerCase();
  if (t.includes('perday') || t.includes('per_day') || t.includes('daily')) return 'DIA';
  if (t.includes('perminute') || t.includes('per_minute')) return 'MINUTO';
  return null;
}
