import { pool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';

/**
 * Cuota diaria del asistente IA: limita cuántas consultas por usuario
 * por día UTC. Reset a las 00:00 UTC del día siguiente.
 *
 * El conteo se persiste en `assistant_quota_log` (una fila por consulta)
 * para que el reinicio del backend o sesiones simultáneas no resetee la
 * cuenta en memoria.
 */

function fechaHoyUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function proximoResetUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function obtenerEstadoCuota(userId) {
  const fecha = fechaHoyUTC();
  const total = env.ASSISTANT_DAILY_QUOTA;
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM assistant_quota_log WHERE user_id = ? AND fecha = ?',
    [userId, fecha]
  );
  const usadas = Number(rows[0]?.n ?? 0);
  const restantes = Math.max(0, total - usadas);
  return {
    usadas,
    restantes,
    total,
    fecha,
    resetEn: proximoResetUTC()
  };
}

/**
 * Llamado antes de procesar la consulta. Verifica que aún haya cupo y
 * registra el consumo. Si la cuota está agotada lanza error 429.
 */
export async function consumirCuota(userId) {
  const estado = await obtenerEstadoCuota(userId);
  if (estado.restantes <= 0) {
    throw new AppError(
      `Usted llegó al límite personal de ${estado.total} consultas al asistente para hoy. ` +
        'Su cuota se renueva mañana; mientras tanto, los demás paneles siguen disponibles.',
      { status: 429, code: 'ASSISTANT_QUOTA_EXCEEDED' }
    );
  }
  await pool.query(
    'INSERT INTO assistant_quota_log (user_id, fecha) VALUES (?, ?)',
    [userId, estado.fecha]
  );
  return {
    ...estado,
    usadas: estado.usadas + 1,
    restantes: estado.restantes - 1
  };
}
