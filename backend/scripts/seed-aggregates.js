/**
 * Tras cargar respuestas demo, congela snapshots mensuales y recalcula
 * el semáforo de los últimos meses. Permite ver datos en los paneles
 * de Tendencias y Semáforo sin tener que llamar la API manualmente.
 */

import { closePool } from '../src/db/pool.js';
import { closeMonth } from '../src/services/snapshots.service.js';
import { recalculateAlerts } from '../src/services/alerts.service.js';
import { logger } from '../src/config/logger.js';

const MONTHS_BACK = Number(process.argv[2] ?? 4);

function periodoYYYYMM(monthsAgo) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  for (let m = MONTHS_BACK - 1; m >= 0; m -= 1) {
    const periodo = periodoYYYYMM(m);
    try {
      const snap = await closeMonth(periodo);
      logger.info({ periodo, ...snap }, 'Snapshot cerrado');
    } catch (err) {
      logger.warn({ periodo, err: err.message }, 'Snapshot ya cerrado o sin datos');
    }
    try {
      const al = await recalculateAlerts({ periodo });
      logger.info({ periodo, ...al }, 'Semáforo recalculado');
    } catch (err) {
      logger.warn({ periodo, err: err.message }, 'Alertas no recalculadas');
    }
  }
}

main()
  .catch((err) => { logger.error({ err }, 'Falló'); process.exitCode = 1; })
  .finally(closePool);
