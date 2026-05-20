import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { round2 } from '../utils/normalize.js';

/**
 * Helpers para construir el filtro WHERE de período (acepta YYYY o YYYY-MM).
 */
function periodFilter(periodo) {
  const isYearOnly = /^\d{4}$/.test(periodo);
  return {
    sql: isYearOnly
      ? "DATE_FORMAT(r.submitted_at, '%Y') = ?"
      : "DATE_FORMAT(r.submitted_at, '%Y-%m') = ?",
    value: periodo
  };
}

/**
 * Agregado base: cuenta respuestas por sentimiento dentro de un periodo y
 * scope. Trabaja sobre `responses.sentimiento` que ya integra la decisión
 * "promedio normalizado → clasificación" de la fase 3.
 *
 * Returns:
 *   {
 *     n_respuestas, pct_positivo, pct_neutro, pct_negativo,
 *     promedio_norm, anonimato_protegido
 *   }
 *
 * Si n_respuestas < MIN_RESPUESTAS_DEPARTAMENTO y se trata de un scope
 * DEPARTMENT, devuelve anonimato_protegido = true y omite los porcentajes
 * para no exponer individuos.
 */
export async function aggregateForScope({ scope, scopeId, periodo }, executor = pool) {
  const filter = periodFilter(periodo);

  let sql;
  const params = [];
  if (scope === 'COMPANY') {
    sql = `SELECT
             COUNT(*) AS n,
             SUM(r.sentimiento = 'POSITIVO') AS pos,
             SUM(r.sentimiento = 'NEUTRO')   AS neu,
             SUM(r.sentimiento = 'NEGATIVO') AS neg,
             AVG(r.score_promedio) AS prom
           FROM responses r
          WHERE r.company_id = ? AND ${filter.sql}`;
    params.push(scopeId, filter.value);
  } else if (scope === 'DEPARTMENT') {
    sql = `SELECT
             COUNT(*) AS n,
             SUM(r.sentimiento = 'POSITIVO') AS pos,
             SUM(r.sentimiento = 'NEUTRO')   AS neu,
             SUM(r.sentimiento = 'NEGATIVO') AS neg,
             AVG(r.score_promedio) AS prom
           FROM responses r
          WHERE r.department_id = ? AND ${filter.sql}`;
    params.push(scopeId, filter.value);
  } else {
    throw new Error(`scope inválido: ${scope}`);
  }

  const [rows] = await executor.query(sql, params);
  const r = rows[0] ?? {};
  const n = Number(r.n ?? 0);

  if (scope === 'DEPARTMENT' && n > 0 && n < env.MIN_RESPUESTAS_DEPARTAMENTO) {
    return {
      n_respuestas: n,
      pct_positivo: null,
      pct_neutro: null,
      pct_negativo: null,
      promedio_norm: null,
      anonimato_protegido: true,
      umbral: env.MIN_RESPUESTAS_DEPARTAMENTO
    };
  }

  if (n === 0) {
    return {
      n_respuestas: 0,
      pct_positivo: 0,
      pct_neutro: 0,
      pct_negativo: 0,
      promedio_norm: null,
      anonimato_protegido: false
    };
  }

  return {
    n_respuestas: n,
    pct_positivo: round2((Number(r.pos) / n) * 100),
    pct_neutro:   round2((Number(r.neu) / n) * 100),
    pct_negativo: round2((Number(r.neg) / n) * 100),
    promedio_norm: r.prom !== null ? round2(Number(r.prom)) : null,
    anonimato_protegido: false
  };
}

/**
 * Agregado por pregunta dentro de un scope (empresa o departamento).
 * Útil para los gráficos del Comparador y los rankings por pregunta.
 */
export async function aggregateForQuestion({ scope, scopeId, questionId, periodo }, executor = pool) {
  const filter = periodFilter(periodo);
  const scopeCol = scope === 'COMPANY' ? 'r.company_id' : 'r.department_id';

  const [rows] = await executor.query(
    `SELECT
        COUNT(*) AS n,
        SUM(a.sentimiento = 'POSITIVO') AS pos,
        SUM(a.sentimiento = 'NEUTRO')   AS neu,
        SUM(a.sentimiento = 'NEGATIVO') AS neg,
        AVG(a.valor_normalizado) AS prom
       FROM answers a
       JOIN responses r ON r.id = a.response_id
      WHERE a.question_id = ?
        AND a.estado = 'PUNTUADA'
        AND ${scopeCol} = ?
        AND ${filter.sql}`,
    [questionId, scopeId, filter.value]
  );
  const r = rows[0] ?? {};
  const n = Number(r.n ?? 0);

  if (scope === 'DEPARTMENT' && n > 0 && n < env.MIN_RESPUESTAS_DEPARTAMENTO) {
    return { n_respuestas: n, anonimato_protegido: true, umbral: env.MIN_RESPUESTAS_DEPARTAMENTO };
  }

  if (n === 0) return { n_respuestas: 0, pct_positivo: 0, pct_neutro: 0, pct_negativo: 0, promedio_norm: null };

  return {
    n_respuestas: n,
    pct_positivo: round2((Number(r.pos) / n) * 100),
    pct_neutro:   round2((Number(r.neu) / n) * 100),
    pct_negativo: round2((Number(r.neg) / n) * 100),
    promedio_norm: r.prom !== null ? round2(Number(r.prom)) : null
  };
}

/**
 * Distribución de opciones para una pregunta en un scope y período.
 * Para las láminas "Tabla de % por opción" del .pptx.
 */
export async function distribucionOpciones({ scope, scopeId, questionId, periodo }, executor = pool) {
  const filter = periodFilter(periodo);
  const scopeCol = scope === 'COMPANY' ? 'r.company_id' : 'r.department_id';

  const [rows] = await executor.query(
    `SELECT a.valor_crudo AS opcion, COUNT(*) AS n
       FROM answers a
       JOIN responses r ON r.id = a.response_id
      WHERE a.question_id = ?
        AND ${scopeCol} = ?
        AND ${filter.sql}
        AND a.valor_crudo IS NOT NULL
      GROUP BY a.valor_crudo
      ORDER BY n DESC`,
    [questionId, scopeId, filter.value]
  );
  const total = rows.reduce((s, r) => s + Number(r.n), 0);
  return rows.map((r) => ({
    opcion: r.opcion,
    n: Number(r.n),
    porcentaje: total ? round2((Number(r.n) / total) * 100) : 0
  }));
}

/**
 * Itera todas las empresas o departamentos con respuestas en el periodo.
 * Usado por snapshots y rankings.
 */
export async function listScopeIdsConRespuestas({ scope, periodo }, executor = pool) {
  const filter = periodFilter(periodo);
  const col = scope === 'COMPANY' ? 'r.company_id' : 'r.department_id';
  const [rows] = await executor.query(
    `SELECT DISTINCT ${col} AS id FROM responses r WHERE ${filter.sql}`,
    [filter.value]
  );
  return rows.map((r) => Number(r.id));
}

/**
 * Lista IDs de preguntas con al menos una answer puntuada dentro del scope/period.
 */
export async function listQuestionIdsConRespuestas({ scope, scopeId, periodo }, executor = pool) {
  const filter = periodFilter(periodo);
  const scopeCol = scope === 'COMPANY' ? 'r.company_id' : 'r.department_id';
  const [rows] = await executor.query(
    `SELECT DISTINCT a.question_id AS id
       FROM answers a JOIN responses r ON r.id = a.response_id
      WHERE a.estado = 'PUNTUADA' AND ${scopeCol} = ? AND ${filter.sql}`,
    [scopeId, filter.value]
  );
  return rows.map((r) => Number(r.id));
}
