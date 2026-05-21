import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { env } from '../../config/env.js';

/**
 * Caché de respuestas del asistente IA.
 *
 *  - Normaliza la pregunta (lower, sin tildes, sin puntuación, espacios
 *    colapsados) y la hashea con SHA-256.
 *  - Si encuentra una respuesta dentro del TTL configurado, la devuelve
 *    inmediatamente sin llamar a Gemini ni descontar cuota del usuario.
 *  - Cada hit incrementa hit_count → alimenta las sugerencias frecuentes.
 */

/**
 * Sinónimos que se tratan como equivalentes al normalizar la pregunta. Esto
 * mejora el hit-rate del caché: "alertas rojas" y "alertas en alto" comparten
 * forma normalizada y comparten respuesta. Solo agregar pares donde el
 * significado sea genuinamente intercambiable en el contexto de clima
 * organizacional de Garnier — sinónimos demasiado amplios contaminan el caché.
 */
const SINONIMOS = [
  // Niveles del termómetro
  [/\b(rojo|alto)\b/g, 'rojo'],
  [/\b(negro|critico|criticos|crisis)\b/g, 'negro'],
  [/\b(amarillo|medio|atencion)\b/g, 'amarillo'],
  [/\b(verde|estable|sano)\b/g, 'verde'],
  // Términos temporales (todos referidos al mes actual)
  [/\b(este mes|el mes actual|ahora|hoy|actualmente|en este momento|al dia de hoy|periodo actual)\b/g, 'este mes'],
  // Términos analíticos comunes
  [/\b(porcentaje positivo|pct positivo|porc positivo|positividad)\b/g, 'porcentaje positivo'],
  [/\b(porcentaje negativo|pct negativo|porc negativo|negatividad)\b/g, 'porcentaje negativo'],
  [/\b(focos|alertas|atencion requerida)\b/g, 'focos'],
  [/\b(top|mejores|los primeros)\b/g, 'top'],
  [/\b(peores|los ultimos|peor)\b/g, 'peor'],
  [/\b(empresa|compania|organizacion)\b/g, 'empresa'],
  [/\b(departamento|equipo|area)\b/g, 'departamento']
];

export function normalizarPregunta(texto) {
  let s = String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // quita marcas diacríticas (acentos, tildes, diéresis)
    .toLowerCase()
    .replace(/[¿¡!?.,;:()"'`´]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [patron, reemplazo] of SINONIMOS) {
    s = s.replace(patron, reemplazo);
  }
  return s.replace(/\s+/g, ' ').trim();
}

function hashear(normalizada) {
  return crypto.createHash('sha256').update(normalizada).digest('hex');
}

export async function lookup(pregunta) {
  const normalizada = normalizarPregunta(pregunta);
  if (!normalizada) return null;
  const hash = hashear(normalizada);
  const [rows] = await pool.query(
    `SELECT id, respuesta_json, modelo, latencia_ms_origen, hit_count, created_at
       FROM assistant_cache
      WHERE pregunta_hash = ?
        AND created_at >= (NOW() - INTERVAL ? MINUTE)
      LIMIT 1`,
    [hash, env.ASSISTANT_CACHE_TTL_MIN]
  );
  if (!rows.length) return null;
  const row = rows[0];

  await pool.query(
    'UPDATE assistant_cache SET hit_count = hit_count + 1, last_hit_at = NOW() WHERE id = ?',
    [row.id]
  );

  const respuesta = typeof row.respuesta_json === 'string'
    ? JSON.parse(row.respuesta_json)
    : row.respuesta_json;

  return {
    ...respuesta,
    desdeCache: true,
    hitCount: row.hit_count + 1,
    cacheCreatedAt: row.created_at,
    latenciaMsOrigen: row.latencia_ms_origen
  };
}

export async function guardar({ pregunta, respuesta }) {
  const normalizada = normalizarPregunta(pregunta);
  if (!normalizada) return;
  const hash = hashear(normalizada);
  const payload = {
    respuesta: respuesta.respuesta,
    toolCalls: respuesta.toolCalls ?? [],
    modelo: respuesta.modelo,
    latenciaMs: respuesta.latenciaMs
  };
  await pool.query(
    `INSERT INTO assistant_cache
       (pregunta_hash, pregunta_original, pregunta_normalizada, respuesta_json, modelo, latencia_ms_origen)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       respuesta_json = VALUES(respuesta_json),
       modelo = VALUES(modelo),
       latencia_ms_origen = VALUES(latencia_ms_origen),
       created_at = NOW()`,
    [
      hash,
      String(pregunta).slice(0, 1000),
      normalizada.slice(0, 1000),
      JSON.stringify(payload),
      respuesta.modelo ?? null,
      Number.isFinite(respuesta.latenciaMs) ? respuesta.latenciaMs : null
    ]
  );
}

/**
 * Top N preguntas más usadas dentro del TTL (respuestas todavía frescas).
 * Útil para alimentar la sección "Preguntas frecuentes" del frontend.
 */
export async function topPreguntas(limit = 5) {
  const [rows] = await pool.query(
    `SELECT pregunta_original, hit_count, created_at, last_hit_at
       FROM assistant_cache
      WHERE created_at >= (NOW() - INTERVAL ? MINUTE)
        AND hit_count >= 1
      ORDER BY hit_count DESC, last_hit_at DESC
      LIMIT ?`,
    [env.ASSISTANT_CACHE_TTL_MIN, Number(limit)]
  );
  return rows.map((r) => ({
    texto: r.pregunta_original,
    hits: Number(r.hit_count)
  }));
}
