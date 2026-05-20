import { pool, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';
import { rankingsRepo } from '../repositories/rankings.repo.js';
import {
  aggregateForScope,
  aggregateForQuestion,
  listScopeIdsConRespuestas
} from './aggregates.service.js';
import { logger } from '../config/logger.js';

const TOP_N = 20;

const TIPOS = new Set(['GLOBAL', 'POR_PREGUNTA', 'POR_DIMENSION']);
const SCOPES = new Set(['COMPANY', 'DEPARTMENT']);

/**
 * Devuelve el ranking solicitado. Si el caché está fresco (calculado_at >
 * última respuesta del periodo), lo retorna. Caso contrario, recalcula,
 * persiste y retorna el resultado nuevo.
 */
export async function getRanking({ tipo, scope, periodo, questionId = null, dimensionId = null }) {
  validar({ tipo, scope, periodo, questionId, dimensionId });

  const cache = await rankingsRepo.findCached(
    { tipo, scope, periodo, question_id: questionId, dimension_id: dimensionId }
  );
  const calculadoAt = cache[0]?.calculado_at ?? null;
  const latest = await rankingsRepo.latestResponseCreatedAt(periodo);

  const cacheFresco = calculadoAt && (!latest || new Date(calculadoAt) >= new Date(latest));
  if (cache.length && cacheFresco) {
    return { fuente: 'CACHE', calculadoAt, items: await enriquecer(cache, { tipo, scope }) };
  }

  const items = await recalcular({ tipo, scope, periodo, questionId, dimensionId });
  return { fuente: 'RECALCULADO', calculadoAt: new Date().toISOString(), items };
}

/**
 * Recalcula y persiste el ranking. Usado tanto on-demand (cache miss) como
 * por el job AlertRefresh cuando se quiere prewarmear todos los rankings.
 */
export async function recalcular({ tipo, scope, periodo, questionId = null, dimensionId = null }) {
  validar({ tipo, scope, periodo, questionId, dimensionId });

  const scopeIds = await listScopeIdsConRespuestas({ scope, periodo });
  if (!scopeIds.length) return [];

  const valoresPorScope = [];
  for (const scopeId of scopeIds) {
    let valor;
    if (tipo === 'GLOBAL') {
      const agg = await aggregateForScope({ scope, scopeId, periodo });
      if (skipPorAnonimato(scope, agg)) continue;
      valor = agg.pct_positivo;
    } else if (tipo === 'POR_PREGUNTA') {
      const agg = await aggregateForQuestion({ scope, scopeId, questionId, periodo });
      if (skipPorAnonimato(scope, agg)) continue;
      valor = agg.pct_positivo;
    } else {
      // POR_DIMENSION: promedia % positivo de todas las preguntas con dimensión X.
      valor = await porcentajePositivoDimension({ scope, scopeId, dimensionId, periodo });
      if (valor === null) continue;
    }

    if (valor !== null && valor !== undefined) {
      valoresPorScope.push({ scopeId, valor });
    }
  }

  valoresPorScope.sort((a, b) => b.valor - a.valor);
  const top = valoresPorScope.slice(0, TOP_N);

  await withTransaction(async (conn) => {
    await rankingsRepo.deleteWhere(
      { tipo, scope, periodo, question_id: questionId, dimension_id: dimensionId },
      conn
    );
    await rankingsRepo.bulkInsert(
      top.map((row, i) => ({
        tipo,
        scope,
        periodo,
        question_id: questionId,
        dimension_id: dimensionId,
        scope_id: row.scopeId,
        posicion: i + 1,
        valor: row.valor
      })),
      conn
    );
  });

  logger.info({ tipo, scope, periodo, top: top.length }, 'Ranking recalculado');

  return enriquecer(
    top.map((row, i) => ({
      tipo,
      scope,
      periodo,
      question_id: questionId,
      dimension_id: dimensionId,
      scope_id: row.scopeId,
      posicion: i + 1,
      valor: row.valor
    })),
    { tipo, scope }
  );
}

function skipPorAnonimato(scope, agg) {
  if (scope !== 'DEPARTMENT') return false;
  if (agg?.anonimato_protegido) return true;
  if ((agg?.n_respuestas ?? 0) < env.MIN_RESPUESTAS_DEPARTAMENTO) return true;
  return false;
}

async function porcentajePositivoDimension({ scope, scopeId, dimensionId, periodo }, executor = pool) {
  const filter = /^\d{4}$/.test(periodo)
    ? "DATE_FORMAT(r.submitted_at, '%Y') = ?"
    : "DATE_FORMAT(r.submitted_at, '%Y-%m') = ?";
  const scopeCol = scope === 'COMPANY' ? 'r.company_id' : 'r.department_id';

  const [rows] = await executor.query(
    `SELECT COUNT(*) AS n, SUM(a.sentimiento = 'POSITIVO') AS pos
       FROM answers a
       JOIN responses r ON r.id = a.response_id
       JOIN questions q ON q.id = a.question_id
      WHERE q.dimension_id = ?
        AND a.estado = 'PUNTUADA'
        AND ${scopeCol} = ?
        AND ${filter}`,
    [dimensionId, scopeId, periodo]
  );
  const n = Number(rows[0]?.n ?? 0);
  if (!n) return null;
  if (scope === 'DEPARTMENT' && n < env.MIN_RESPUESTAS_DEPARTAMENTO) return null;
  return Math.round(((Number(rows[0].pos) / n) * 100 + Number.EPSILON) * 100) / 100;
}

/**
 * Enriquece los items del ranking con el nombre de la empresa/departamento.
 */
async function enriquecer(items, { scope }) {
  if (!items.length) return [];
  const ids = items.map((i) => i.scope_id);
  const placeholders = ids.map(() => '?').join(',');
  const sql = scope === 'COMPANY'
    ? `SELECT id, nombre FROM companies WHERE id IN (${placeholders})`
    : `SELECT d.id, d.nombre, c.id AS company_id, c.nombre AS empresa
         FROM departments d JOIN companies c ON c.id = d.company_id
        WHERE d.id IN (${placeholders})`;
  const [rows] = await pool.query(sql, ids);
  const byId = new Map(rows.map((r) => [Number(r.id), r]));

  return items.map((i) => ({
    posicion: i.posicion,
    scope_id: i.scope_id,
    valor: Number(i.valor),
    ...(scope === 'COMPANY'
      ? { empresa: byId.get(i.scope_id)?.nombre }
      : {
          departamento: byId.get(i.scope_id)?.nombre,
          empresa: byId.get(i.scope_id)?.empresa,
          company_id: byId.get(i.scope_id)?.company_id
        })
  }));
}

function validar({ tipo, scope, periodo, questionId, dimensionId }) {
  if (!TIPOS.has(tipo)) throw new Error(`tipo inválido: ${tipo}`);
  if (!SCOPES.has(scope)) throw new Error(`scope inválido: ${scope}`);
  if (!periodo) throw new Error('periodo requerido');
  if (tipo === 'POR_PREGUNTA' && !questionId) throw new Error('questionId requerido para POR_PREGUNTA');
  if (tipo === 'POR_DIMENSION' && !dimensionId) throw new Error('dimensionId requerido para POR_DIMENSION');
}
