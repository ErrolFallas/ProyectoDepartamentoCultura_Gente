import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const KEYWORDS_NEGATIVAS = [
  'estrés', 'estres', 'renunciar', 'abandonar', 'acoso', 'maltrato',
  'burnout', 'agotamiento', 'frustración', 'frustracion', 'molesto',
  'enfadado', 'enojado', 'triste', 'ansioso', 'ansiedad', 'quejar',
  'queja', 'malestar', 'dificultad', 'no me siento'
];

const KEYWORDS_POSITIVAS = [
  'orgulloso', 'satisfecho', 'feliz', 'motivado', 'agradable',
  'recomendar', 'reconocido', 'valorado', 'apoyo', 'crecer', 'aprender'
];

const KEYWORDS_NEUTRAS = [
  'edad', 'sexo', 'género', 'genero', 'antigüedad', 'antiguedad',
  'rango', 'departamento', 'puesto', 'turno'
];

/**
 * Cliente Gemini con doble personalidad: cuando GEMINI_API_KEY está vacío
 * funciona como mock heurístico para no bloquear el desarrollo, pero
 * exponiendo exactamente la misma interfaz que la versión real.
 */
class GeminiClient {
  constructor() {
    this.enabled = Boolean(env.GEMINI_API_KEY);
    this.model = env.GEMINI_MODEL;
  }

  /**
   * Devuelve { polaridad, dimension, razon, confianza, estado, modelo }.
   * Nunca aplica polaridad por sí solo: el flujo de aprendizaje exige
   * confirmación humana en el catálogo.
   */
  async clasificarPolaridad({ texto, escalaTipo }) {
    if (!this.enabled) return this._mockClasificarPolaridad({ texto, escalaTipo });
    return this._realClasificarPolaridad({ texto, escalaTipo });
  }

  /**
   * Devuelve { tono, temas, confianza, modelo } para respuestas de texto abierto.
   * Nunca atribuye frases a personas: solo describe tono y temas recurrentes.
   */
  async analizarTextoAbierto({ texto }) {
    if (!this.enabled) return this._mockAnalizarTexto({ texto });
    return this._realAnalizarTexto({ texto });
  }

  // -------------------- mock ----------------------------------------

  _mockClasificarPolaridad({ texto, escalaTipo }) {
    const lower = (texto ?? '').toLowerCase();

    if (escalaTipo === 'ABIERTA') {
      return this._respuesta('NEUTRA', 'COMUNICACION', 'Escala abierta no puntúa numéricamente', 0.6, 'mock');
    }

    const esDemografica = KEYWORDS_NEUTRAS.some((k) => lower.includes(k));
    if (esDemografica) {
      return this._respuesta('NEUTRA', 'DEMOGRAFICA', 'Pregunta demográfica informativa', 0.85, 'mock');
    }

    const hits = KEYWORDS_NEGATIVAS.filter((k) => lower.includes(k));
    if (hits.length) {
      return this._respuesta(
        'INVERSA',
        'MOTIVACION',
        `Detectados términos negativos (${hits.slice(0, 3).join(', ')}) — número alto sugiere malestar`,
        Math.min(0.95, 0.7 + 0.05 * hits.length),
        'mock'
      );
    }

    return this._respuesta('DIRECTA', 'CLIMA_GENERAL', 'Sin marcadores negativos; se asume polaridad directa', 0.55, 'mock');
  }

  _mockAnalizarTexto({ texto }) {
    const lower = (texto ?? '').toLowerCase();
    const neg = KEYWORDS_NEGATIVAS.filter((k) => lower.includes(k));
    const pos = KEYWORDS_POSITIVAS.filter((k) => lower.includes(k));

    let tono = 'NEUTRO';
    if (neg.length > pos.length) tono = 'NEGATIVO';
    else if (pos.length > neg.length) tono = 'POSITIVO';

    const temas = [...new Set([...neg, ...pos])].slice(0, 5);

    return {
      tono,
      temas,
      score_confianza: 0.6,
      modelo: 'mock'
    };
  }

  // -------------------- real (preparado, sin bloquear si falla) -----

  async _realClasificarPolaridad({ texto, escalaTipo }) {
    try {
      const prompt = buildPolaridadPrompt({ texto, escalaTipo });
      const data = await this._callGemini(prompt);
      const parsed = parsePolaridadResponse(data);
      return this._respuesta(
        parsed.polaridad,
        parsed.dimension,
        parsed.razon,
        parsed.confianza ?? 0.7,
        this.model
      );
    } catch (err) {
      logger.warn({ err: err.message }, 'Gemini falló, cayendo a mock');
      return this._mockClasificarPolaridad({ texto, escalaTipo });
    }
  }

  async _realAnalizarTexto({ texto }) {
    try {
      const prompt = buildTextoAbiertoPrompt({ texto });
      const data = await this._callGemini(prompt);
      return parseTextoAbiertoResponse(data, this.model);
    } catch (err) {
      logger.warn({ err: err.message }, 'Gemini análisis abierto falló, cayendo a mock');
      return this._mockAnalizarTexto({ texto });
    }
  }

  async _callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${env.GEMINI_API_KEY}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gemini ${resp.status}: ${text.slice(0, 200)}`);
    }
    return resp.json();
  }

  _respuesta(polaridad, dimension, razon, confianza, modelo) {
    return {
      polaridad,
      dimension,
      razon,
      confianza,
      modelo,
      estado: 'PENDIENTE_REVISION'
    };
  }
}

function buildPolaridadPrompt({ texto, escalaTipo }) {
  return `Eres un analista de clima organizacional. Devuelve JSON estricto con la
polaridad de la siguiente pregunta. Polaridad DIRECTA = número alto significa
emoción positiva. INVERSA = número alto significa emoción negativa. NEUTRA =
pregunta demográfica informativa, no puntúa.

Pregunta: """${texto}"""
Tipo de escala: ${escalaTipo ?? 'desconocida'}

Responde JSON con claves: polaridad, dimension, razon, confianza (0-1).`;
}

function buildTextoAbiertoPrompt({ texto }) {
  return `Eres un analista de clima organizacional. Analiza la siguiente respuesta
abierta y devuelve JSON con tono (POSITIVO|NEUTRO|NEGATIVO) y hasta 5 temas
recurrentes (palabras o frases cortas). No atribuyas la frase a una persona.

Texto: """${texto}"""

Responde JSON con claves: tono, temas (array), score_confianza (0-1).`;
}

function parsePolaridadResponse(raw) {
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(text);
  return {
    polaridad: normalizarPolaridad(parsed.polaridad),
    dimension: parsed.dimension ?? null,
    razon: parsed.razon ?? null,
    confianza: clampConfianza(parsed.confianza)
  };
}

function parseTextoAbiertoResponse(raw, modelo) {
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(text);
  return {
    tono: normalizarTono(parsed.tono),
    temas: Array.isArray(parsed.temas) ? parsed.temas.slice(0, 5) : [],
    score_confianza: clampConfianza(parsed.score_confianza),
    modelo
  };
}

function normalizarPolaridad(p) {
  const v = String(p ?? '').toUpperCase();
  return ['DIRECTA', 'INVERSA', 'NEUTRA'].includes(v) ? v : 'DIRECTA';
}

function normalizarTono(t) {
  const v = String(t ?? '').toUpperCase();
  return ['POSITIVO', 'NEUTRO', 'NEGATIVO'].includes(v) ? v : 'NEUTRO';
}

function clampConfianza(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

export const geminiService = new GeminiClient();
