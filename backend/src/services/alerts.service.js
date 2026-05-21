import { pool, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';
import { alertsRepo } from '../repositories/alerts.repo.js';
import { aggregateForScope, listScopeIdsConRespuestas } from './aggregates.service.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

const PERIODO_RX_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function clasificarNivel(pctNegativo) {
  if (pctNegativo === null || pctNegativo === undefined) return 'VERDE';
  if (pctNegativo >= env.SEMAFORO_NEGRO_MIN) return 'NEGRO';
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
  const resumen = { periodo, evaluados: departmentIds.length, omitidos: 0, niveles: { VERDE: 0, AMARILLO: 0, ROJO: 0, NEGRO: 0 } };

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

export async function marcarAtendida({ alertId, usuarioId, notas, atendidaAt }) {
  const alerta = await alertsRepo.findById(alertId);
  if (!alerta) throw new NotFoundError('Alerta no encontrada');
  // Convierte ISO → DATETIME MySQL ('YYYY-MM-DD HH:MM:SS') si vino fecha custom.
  let fechaMysql = null;
  if (atendidaAt) {
    const d = new Date(atendidaAt);
    if (Number.isNaN(d.getTime())) {
      throw new ValidationError('Fecha de visita inválida', [{ path: 'atendida_at', message: 'fecha inválida' }]);
    }
    fechaMysql = d.toISOString().slice(0, 19).replace('T', ' ');
  }
  await alertsRepo.marcarAtendida({ id: alertId, usuarioId, notas, atendidaAt: fechaMysql });
  return { id: alertId, atendida: true, atendidaAt: fechaMysql };
}

export async function desmarcarAtendida({ alertId, motivo }) {
  const alerta = await alertsRepo.findById(alertId);
  if (!alerta) throw new NotFoundError('Alerta no encontrada');
  if (!alerta.atendida) {
    // Idempotente: si ya no está atendida, no hace nada.
    return { id: alertId, atendida: false };
  }
  await alertsRepo.desmarcarAtendida({ id: alertId, motivo });
  return { id: alertId, atendida: false };
}

export async function obtenerDetalle({ alertId }) {
  const detalle = await alertsRepo.findByIdConDetalle(alertId);
  if (!detalle) throw new NotFoundError('Alerta no encontrada');
  return detalle;
}

/**
 * Resumen para el asistente de notificaciones (Panel 3). Devuelve los focos
 * ROJO/AMARILLO del último período cerrado.
 */
export async function focosActuales({ periodo }) {
  const efectivo = periodo ?? mesActualUTC();
  const negros = await alertsRepo.list({ periodo: efectivo, nivel: 'NEGRO' });
  const rojos = await alertsRepo.list({ periodo: efectivo, nivel: 'ROJO' });
  const amarillos = await alertsRepo.list({ periodo: efectivo, nivel: 'AMARILLO' });
  const todasLasAlertas = await alertsRepo.list({ periodo: efectivo });
  return {
    periodo: efectivo,
    negros,
    rojos,
    amarillos,
    total: negros.length + rojos.length + amarillos.length,
    totalDeptos: todasLasAlertas.length
  };
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
