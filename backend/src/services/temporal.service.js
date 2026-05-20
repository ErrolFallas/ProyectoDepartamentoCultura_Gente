import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { round2 } from '../utils/normalize.js';
import { snapshotsRepo } from '../repositories/snapshots.repo.js';

const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Distribución de respuestas por día de la semana dentro de un periodo
 * (mes o año). Útil para detectar "lunes con caída de ánimo".
 *
 * Aplica el umbral de anonimato cuando scope = DEPARTMENT: si el total
 * del período cae por debajo del mínimo, no devolvemos la disgregación.
 */
export async function distribucionPorDiaSemana({ scope, scopeId, periodo }) {
  const filter = periodoFilter(periodo);
  const scopeCol = scope === 'COMPANY' ? 'company_id' : 'department_id';

  const [totalRow] = await pool.query(
    `SELECT COUNT(*) AS n FROM responses
      WHERE ${scopeCol} = ? AND ${filter.sql}`,
    [scopeId, filter.value]
  );
  const total = Number(totalRow[0]?.n ?? 0);
  if (scope === 'DEPARTMENT' && total < env.MIN_RESPUESTAS_DEPARTAMENTO) {
    return { anonimato_protegido: true, umbral: env.MIN_RESPUESTAS_DEPARTAMENTO, n_respuestas: total };
  }
  if (!total) return { n_respuestas: 0, items: DOW.map((label, idx) => emptyDow(idx, label)) };

  const [rows] = await pool.query(
    `SELECT DAYOFWEEK(submitted_at) AS dow,
            COUNT(*) AS n,
            SUM(sentimiento = 'NEGATIVO') AS neg,
            SUM(sentimiento = 'POSITIVO') AS pos
       FROM responses
      WHERE ${scopeCol} = ? AND ${filter.sql}
      GROUP BY DAYOFWEEK(submitted_at)`,
    [scopeId, filter.value]
  );

  const map = new Map(rows.map((r) => [Number(r.dow), r]));
  const items = DOW.map((label, idx) => {
    const r = map.get(idx + 1);
    if (!r) return emptyDow(idx, label);
    const n = Number(r.n);
    return {
      dow: idx + 1,
      label,
      n_respuestas: n,
      pct_negativo: round2((Number(r.neg) / n) * 100),
      pct_positivo: round2((Number(r.pos) / n) * 100)
    };
  });

  return { n_respuestas: total, items };
}

/**
 * Cronicidad: cuántos meses consecutivos (hacia atrás desde el último
 * período cerrado) el departamento estuvo en ROJO o AMARILLO según los
 * snapshots inmutables.
 */
export async function cronicidad({ scope, scopeId, lookbackMonths = 12 }) {
  const historia = await snapshotsRepo.listHistory(
    { scope, scope_id: scopeId, question_id: null, lookbackMonths }
  );
  if (!historia.length) return { meses: 0, nivelActual: 'VERDE', historia: [] };

  const ordenada = [...historia].reverse(); // más reciente primero
  let mesesEnAlerta = 0;
  let nivelActual = 'VERDE';
  for (const snap of ordenada) {
    const nivel = clasificarPorPctNeg(Number(snap.pct_negativo));
    if (nivel === 'VERDE') break;
    mesesEnAlerta += 1;
    if (mesesEnAlerta === 1) nivelActual = nivel;
  }

  return {
    meses: mesesEnAlerta,
    nivelActual,
    cronica: mesesEnAlerta >= 3,
    historia
  };
}

function clasificarPorPctNeg(pctNeg) {
  if (pctNeg >= env.SEMAFORO_ROJO_MIN) return 'ROJO';
  if (pctNeg >= env.SEMAFORO_AMARILLO_MIN) return 'AMARILLO';
  return 'VERDE';
}

function emptyDow(idx, label) {
  return { dow: idx + 1, label, n_respuestas: 0, pct_negativo: 0, pct_positivo: 0 };
}

function periodoFilter(periodo) {
  const isYearOnly = /^\d{4}$/.test(periodo);
  return {
    sql: isYearOnly
      ? "DATE_FORMAT(submitted_at, '%Y') = ?"
      : "DATE_FORMAT(submitted_at, '%Y-%m') = ?",
    value: periodo
  };
}
