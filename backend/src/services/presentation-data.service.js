import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { round2 } from '../utils/normalize.js';
import {
  aggregateForScope,
  aggregateForQuestion,
  distribucionOpciones
} from './aggregates.service.js';
import { getRanking } from './rankings.service.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

/**
 * Reúne en un solo lugar la información que arma la presentación.
 * No genera el .pptx (eso lo hace presentation-builder); solo
 * provee los bloques estructurados que cualquier renderer puede
 * consumir (PPTX hoy, HTML/PDF mañana).
 */
export async function recolectarDatosInforme({ scope, scopeId, periodo }) {
  validar({ scope, scopeId, periodo });

  const meta = await cargarMeta({ scope, scopeId });
  if (!meta) throw new NotFoundError(`${scope === 'COMPANY' ? 'Empresa' : 'Departamento'} no existe`);

  const agregado = await aggregateForScope({ scope, scopeId, periodo });
  const posicionRanking = await obtenerPosicionEnRanking({ scope, scopeId, periodo });
  const nivelSemaforo = await obtenerNivelSemaforo({ scope, scopeId, periodo, pctNegativo: agregado.pct_negativo });

  const preguntasConDatos = await preguntasConAgregado({ scope, scopeId, periodo });
  const dimensiones = agruparPorDimension(preguntasConDatos);
  const mejores = ordenarPorPctPositivo(preguntasConDatos).slice(0, 5);
  const peores = ordenarPorPctNegativo(preguntasConDatos).slice(0, 5);

  const temas = await temasTextoAbierto({ scope, scopeId, periodo });

  return {
    meta,
    periodo,
    scope,
    agregado,
    posicionRanking,
    nivelSemaforo,
    dimensiones,
    mejores,
    peores,
    temas
  };
}

// ---------------------------------------------------------------------
// Bloques de datos
// ---------------------------------------------------------------------

async function cargarMeta({ scope, scopeId }) {
  if (scope === 'COMPANY') {
    const [rows] = await pool.query(
      'SELECT id, nombre FROM companies WHERE id = ? LIMIT 1',
      [scopeId]
    );
    if (!rows[0]) return null;
    return { tipo: 'EMPRESA', id: rows[0].id, nombre: rows[0].nombre, empresa: null };
  }
  const [rows] = await pool.query(
    `SELECT d.id, d.nombre, c.id AS company_id, c.nombre AS empresa
       FROM departments d JOIN companies c ON c.id = d.company_id
      WHERE d.id = ? LIMIT 1`,
    [scopeId]
  );
  if (!rows[0]) return null;
  return {
    tipo: 'DEPARTAMENTO',
    id: rows[0].id,
    nombre: rows[0].nombre,
    empresa: { id: rows[0].company_id, nombre: rows[0].empresa }
  };
}

async function obtenerPosicionEnRanking({ scope, scopeId, periodo }) {
  try {
    const r = await getRanking({ tipo: 'GLOBAL', scope, periodo });
    const propio = r.items.find((i) => i.scope_id === scopeId);
    return propio ? { posicion: propio.posicion, totalEnRanking: r.items.length, valor: propio.valor } : null;
  } catch {
    return null;
  }
}

async function obtenerNivelSemaforo({ scope, scopeId, periodo, pctNegativo }) {
  if (scope === 'DEPARTMENT') {
    const [rows] = await pool.query(
      'SELECT nivel, pct_negativo FROM alerts WHERE department_id = ? AND periodo = ? LIMIT 1',
      [scopeId, periodo]
    );
    if (rows[0]) return { nivel: rows[0].nivel, pct_negativo: Number(rows[0].pct_negativo) };
  }
  // Fallback: calcular usando umbrales
  if (pctNegativo === null || pctNegativo === undefined) return { nivel: 'VERDE', pct_negativo: 0 };
  const v = Number(pctNegativo);
  const nivel = v >= env.SEMAFORO_ROJO_MIN ? 'ROJO' : v >= env.SEMAFORO_AMARILLO_MIN ? 'AMARILLO' : 'VERDE';
  return { nivel, pct_negativo: v };
}

async function preguntasConAgregado({ scope, scopeId, periodo }) {
  const filter = /^\d{4}$/.test(periodo)
    ? "DATE_FORMAT(r.submitted_at, '%Y') = ?"
    : "DATE_FORMAT(r.submitted_at, '%Y-%m') = ?";
  const scopeCol = scope === 'COMPANY' ? 'r.company_id' : 'r.department_id';

  const [rows] = await pool.query(
    `SELECT q.id, q.texto, q.polaridad,
            d.id AS dimension_id, d.nombre AS dimension, d.orden AS dimension_orden,
            COUNT(*) AS n,
            SUM(a.sentimiento = 'POSITIVO') AS pos,
            SUM(a.sentimiento = 'NEUTRO')   AS neu,
            SUM(a.sentimiento = 'NEGATIVO') AS neg,
            AVG(a.valor_normalizado) AS prom
       FROM answers a
       JOIN questions q ON q.id = a.question_id
       LEFT JOIN dimensions d ON d.id = q.dimension_id
       JOIN responses r ON r.id = a.response_id
      WHERE a.estado = 'PUNTUADA'
        AND ${scopeCol} = ?
        AND ${filter}
      GROUP BY q.id, q.texto, q.polaridad, d.id, d.nombre, d.orden`,
    [scopeId, periodo]
  );

  return rows.map((r) => {
    const n = Number(r.n);
    return {
      question_id: r.id,
      texto: r.texto,
      polaridad: r.polaridad,
      dimension_id: r.dimension_id,
      dimension: r.dimension ?? 'Sin dimensión',
      dimension_orden: r.dimension_orden ?? 999,
      n_respuestas: n,
      pct_positivo: round2((Number(r.pos) / n) * 100),
      pct_neutro:   round2((Number(r.neu) / n) * 100),
      pct_negativo: round2((Number(r.neg) / n) * 100),
      promedio_norm: r.prom !== null ? round2(Number(r.prom)) : null
    };
  });
}

function agruparPorDimension(preguntas) {
  const map = new Map();
  for (const p of preguntas) {
    const key = p.dimension_id ?? 0;
    if (!map.has(key)) {
      map.set(key, {
        dimension_id: p.dimension_id,
        dimension: p.dimension,
        orden: p.dimension_orden,
        preguntas: [],
        pct_positivo_promedio: 0,
        pct_negativo_promedio: 0,
        n_respuestas_total: 0
      });
    }
    map.get(key).preguntas.push(p);
  }
  const out = [];
  for (const g of map.values()) {
    const totalN = g.preguntas.reduce((s, q) => s + q.n_respuestas, 0);
    const pos = g.preguntas.reduce((s, q) => s + q.pct_positivo * q.n_respuestas, 0) / Math.max(1, totalN);
    const neg = g.preguntas.reduce((s, q) => s + q.pct_negativo * q.n_respuestas, 0) / Math.max(1, totalN);
    out.push({
      ...g,
      n_respuestas_total: totalN,
      pct_positivo_promedio: round2(pos),
      pct_negativo_promedio: round2(neg)
    });
  }
  return out.sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
}

function ordenarPorPctPositivo(arr) {
  return [...arr]
    .filter((p) => p.polaridad !== 'NEUTRA' && p.n_respuestas > 0)
    .sort((a, b) => b.pct_positivo - a.pct_positivo);
}

function ordenarPorPctNegativo(arr) {
  return [...arr]
    .filter((p) => p.polaridad !== 'NEUTRA' && p.n_respuestas > 0)
    .sort((a, b) => b.pct_negativo - a.pct_negativo);
}

async function temasTextoAbierto({ scope, scopeId, periodo }) {
  const filter = /^\d{4}$/.test(periodo)
    ? "DATE_FORMAT(r.submitted_at, '%Y') = ?"
    : "DATE_FORMAT(r.submitted_at, '%Y-%m') = ?";
  const scopeCol = scope === 'COMPANY' ? 'r.company_id' : 'r.department_id';

  const [rows] = await pool.query(
    `SELECT ota.tono, ota.temas
       FROM open_text_analysis ota
       JOIN answers a ON a.id = ota.answer_id
       JOIN responses r ON r.id = a.response_id
      WHERE ${scopeCol} = ?
        AND ${filter}`,
    [scopeId, periodo]
  );

  const conteo = new Map();
  let positivos = 0;
  let neutros = 0;
  let negativos = 0;
  for (const r of rows) {
    if (r.tono === 'POSITIVO') positivos += 1;
    else if (r.tono === 'NEUTRO') neutros += 1;
    else if (r.tono === 'NEGATIVO') negativos += 1;
    const temas = parseTemas(r.temas);
    for (const t of temas) {
      const key = String(t).toLowerCase().trim();
      if (!key) continue;
      conteo.set(key, (conteo.get(key) ?? 0) + 1);
    }
  }
  const top = [...conteo.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tema, ocurrencias]) => ({ tema, ocurrencias }));

  return {
    total_respuestas_abiertas: rows.length,
    distribucion_tono: { positivos, neutros, negativos },
    top_temas: top
  };
}

function parseTemas(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { const j = JSON.parse(value); return Array.isArray(j) ? j : []; } catch { return []; }
  }
  return [];
}

function validar({ scope, scopeId, periodo }) {
  if (!['COMPANY', 'DEPARTMENT'].includes(scope)) {
    throw new ValidationError('scope inválido', [{ path: 'scope', message: 'COMPANY o DEPARTMENT' }]);
  }
  if (!Number.isInteger(scopeId) || scopeId <= 0) {
    throw new ValidationError('scope_id inválido');
  }
  if (!/^\d{4}(-\d{2})?$/.test(periodo)) {
    throw new ValidationError('periodo debe ser YYYY-MM o YYYY');
  }
}

// Exporto helpers internos para usar desde el builder si hace falta
// detalles puntuales (distribución de opciones de una pregunta, etc.).
export { aggregateForQuestion, distribucionOpciones };
