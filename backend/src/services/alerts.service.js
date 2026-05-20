import { pool, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';
import { alertsRepo } from '../repositories/alerts.repo.js';
import { aggregateForScope, listScopeIdsConRespuestas } from './aggregates.service.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

const PERIODO_RX_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function clasificarNivel(pctNegativo) {
  if (pctNegativo === null || pctNegativo === undefined) return 'VERDE';
  if (pctNegativo >= env.SEMAFORO_ROJO_MIN) return 'ROJO';
  if (pctNegativo >= env.SEMAFORO_AMARILLO_MIN) return 'AMARILLO';
  return 'VERDE';
}

/**
 * Recorre todos los departamentos con respuestas en el período y
 * upsertea su alerta. No expone departamentos por debajo del umbral
 * de anonimato (no se crea alerta para esos casos).
 */
export async function recalculateAlerts({ periodo }) {
  if (!PERIODO_RX_MES.test(periodo)) {
    throw new ValidationError('periodo debe ser YYYY-MM', [{ path: 'periodo', message: 'YYYY-MM' }]);
  }

  const departmentIds = await listScopeIdsConRespuestas({ scope: 'DEPARTMENT', periodo });
  const resumen = { periodo, evaluados: departmentIds.length, omitidos: 0, niveles: { VERDE: 0, AMARILLO: 0, ROJO: 0 } };

  await withTransaction(async (conn) => {
    for (const deptId of departmentIds) {
      const agg = await aggregateForScope({ scope: 'DEPARTMENT', scopeId: deptId, periodo }, conn);
      if (agg.anonimato_protegido || !agg.n_respuestas) {
        resumen.omitidos += 1;
        continue;
      }
      const nivel = clasificarNivel(agg.pct_negativo);
      resumen.niveles[nivel] += 1;
      await alertsRepo.upsert(
        {
          department_id: deptId,
          periodo,
          pct_negativo: agg.pct_negativo ?? 0,
          nivel
        },
        conn
      );
    }
  });

  logger.info(resumen, 'Semáforo recalculado');
  return resumen;
}

export async function listAlerts(filtros) {
  return alertsRepo.list(filtros);
}

export async function marcarAtendida({ alertId, usuarioId, notas }) {
  const alerta = await alertsRepo.findById(alertId);
  if (!alerta) throw new NotFoundError('Alerta no encontrada');
  await alertsRepo.marcarAtendida({ id: alertId, usuarioId, notas });
  return { id: alertId, atendida: true };
}

/**
 * Resumen para el asistente de notificaciones (Panel 3). Devuelve los focos
 * ROJO/AMARILLO del último período cerrado.
 */
export async function focosActuales({ periodo }) {
  const efectivo = periodo ?? mesActualUTC();
  const rojos = await alertsRepo.list({ periodo: efectivo, nivel: 'ROJO' });
  const amarillos = await alertsRepo.list({ periodo: efectivo, nivel: 'AMARILLO' });
  return { periodo: efectivo, rojos, amarillos, total: rojos.length + amarillos.length };
}

function mesActualUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Diagnóstico interno usado en tests para validar la clasificación
 * sin tocar la base.
 */
export const _internals = { clasificarNivel };
