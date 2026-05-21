/**
 * Post-procesamiento del seed demo:
 *  1. Recalcula el semáforo de alertas mes a mes.
 *  2. Cierra (congela) los snapshots mensuales inmutables.
 *
 * Uso:
 *   node backend/scripts/seed-post-process.js [--months 8]
 */

import { closePool } from '../src/db/pool.js';
import { recalculateAlerts } from '../src/services/alerts.service.js';
import { closeMonth } from '../src/services/snapshots.service.js';
import { logger } from '../src/config/logger.js';

const argv = parseArgs(process.argv.slice(2));
const MONTHS_BACK = argv['months'] ?? 8;

function periodoFor(monthsAgo) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  logger.info({ MONTHS_BACK }, 'Iniciando post-procesamiento');

  const periodos = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i -= 1) periodos.push(periodoFor(i));

  for (const periodo of periodos) {
    try {
      const alertSummary = await recalculateAlerts({ periodo });
      logger.info({ periodo, ...alertSummary.niveles, evaluados: alertSummary.evaluados }, 'Semáforo recalculado');
    } catch (err) {
      logger.warn({ err: err.message, periodo }, 'Recalculo de alertas falló');
    }

    try {
      const snap = await closeMonth(periodo);
      logger.info({ periodo, escritos: snap.escritos, omitidos: snap.omitidos }, 'Snapshot cerrado');
    } catch (err) {
      logger.warn({ err: err.message, periodo }, 'Cierre de snapshot falló');
    }
  }

  logger.info('Post-procesamiento terminado');
}

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else { out[key] = Number.isNaN(Number(next)) ? next : Number(next); i += 1; }
    }
  }
  return out;
}

main()
  .catch((err) => {
    logger.error({ err }, 'Post-procesamiento falló');
    process.exitCode = 1;
  })
  .finally(closePool);
