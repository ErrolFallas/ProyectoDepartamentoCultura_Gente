import { pool, withTransaction } from '../db/pool.js';
import { snapshotsRepo } from '../repositories/snapshots.repo.js';
import {
  aggregateForScope,
  aggregateForQuestion,
  listScopeIdsConRespuestas,
  listQuestionIdsConRespuestas
} from './aggregates.service.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

const PERIODO_RX = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Cierra (congela) un periodo mensual: persiste un snapshot inmutable
 * para cada empresa, departamento, empresa×pregunta y depto×pregunta
 * que tuvo respuestas en el mes. Los snapshots existentes NO se
 * sobreescriben (INSERT IGNORE → regla del plan).
 *
 * @returns { periodo, escritos, omitidos }
 */
export async function closeMonth(periodo) {
  if (!PERIODO_RX.test(periodo)) {
    throw new ValidationError('periodo debe tener formato YYYY-MM', [{ path: 'periodo', message: 'YYYY-MM' }]);
  }

  let escritos = 0;
  let omitidos = 0;
  const escribirSnapshot = async (row, conn) => {
    const { inserted } = await snapshotsRepo.insertIfMissing(row, conn);
    if (inserted) escritos += 1; else omitidos += 1;
  };

  await withTransaction(async (conn) => {
    // Empresas con datos en el período
    const companyIds = await listScopeIdsConRespuestas({ scope: 'COMPANY', periodo }, conn);
    for (const companyId of companyIds) {
      const agg = await aggregateForScope({ scope: 'COMPANY', scopeId: companyId, periodo }, conn);
      if (!agg.n_respuestas) continue;
      await escribirSnapshot(
        {
          periodo,
          scope: 'COMPANY',
          scope_id: companyId,
          question_id: null,
          n_respuestas: agg.n_respuestas,
          pct_positivo: agg.pct_positivo ?? 0,
          pct_neutro: agg.pct_neutro ?? 0,
          pct_negativo: agg.pct_negativo ?? 0,
          promedio_norm: agg.promedio_norm ?? 0
        },
        conn
      );

      const questionIds = await listQuestionIdsConRespuestas(
        { scope: 'COMPANY', scopeId: companyId, periodo },
        conn
      );
      for (const qid of questionIds) {
        const qagg = await aggregateForQuestion(
          { scope: 'COMPANY', scopeId: companyId, questionId: qid, periodo },
          conn
        );
        if (!qagg.n_respuestas || qagg.anonimato_protegido) continue;
        await escribirSnapshot(
          {
            periodo,
            scope: 'QUESTION_COMPANY',
            scope_id: companyId,
            question_id: qid,
            n_respuestas: qagg.n_respuestas,
            pct_positivo: qagg.pct_positivo ?? 0,
            pct_neutro: qagg.pct_neutro ?? 0,
            pct_negativo: qagg.pct_negativo ?? 0,
            promedio_norm: qagg.promedio_norm ?? 0
          },
          conn
        );
      }
    }

    const departmentIds = await listScopeIdsConRespuestas({ scope: 'DEPARTMENT', periodo }, conn);
    for (const deptId of departmentIds) {
      const agg = await aggregateForScope({ scope: 'DEPARTMENT', scopeId: deptId, periodo }, conn);
      // En snapshots NO aplicamos el filtro de anonimato: la tabla se usa
      // para agregados internos y para reconstruir empresa cuando un
      // depto pequeño se absorbe. La protección se aplica al EXPONER.
      if (!agg.n_respuestas) continue;
      await escribirSnapshot(
        {
          periodo,
          scope: 'DEPARTMENT',
          scope_id: deptId,
          question_id: null,
          n_respuestas: agg.n_respuestas,
          pct_positivo: agg.pct_positivo ?? 0,
          pct_neutro: agg.pct_neutro ?? 0,
          pct_negativo: agg.pct_negativo ?? 0,
          promedio_norm: agg.promedio_norm ?? 0
        },
        conn
      );

      const questionIds = await listQuestionIdsConRespuestas(
        { scope: 'DEPARTMENT', scopeId: deptId, periodo },
        conn
      );
      for (const qid of questionIds) {
        const qagg = await aggregateForQuestion(
          { scope: 'DEPARTMENT', scopeId: deptId, questionId: qid, periodo },
          conn
        );
        if (!qagg.n_respuestas) continue;
        await escribirSnapshot(
          {
            periodo,
            scope: 'QUESTION_DEPARTMENT',
            scope_id: deptId,
            question_id: qid,
            n_respuestas: qagg.n_respuestas,
            pct_positivo: qagg.pct_positivo ?? 0,
            pct_neutro: qagg.pct_neutro ?? 0,
            pct_negativo: qagg.pct_negativo ?? 0,
            promedio_norm: qagg.promedio_norm ?? 0
          },
          conn
        );
      }
    }
  });

  logger.info({ periodo, escritos, omitidos }, 'Snapshot mensual cerrado');
  return { periodo, escritos, omitidos };
}

export async function listSnapshots({ periodo, scope = null } = {}) {
  return snapshotsRepo.listByPeriodo(periodo, scope);
}

export async function getHistory({ scope, scopeId, questionId = null, lookbackMonths = 12 }, executor = pool) {
  return snapshotsRepo.listHistory(
    { scope, scope_id: scopeId, question_id: questionId, lookbackMonths },
    executor
  );
}
