import { pool } from '../db/pool.js';

export const snapshotsRepo = {
  async findOne({ periodo, scope, scope_id, question_id = null }, executor = pool) {
    const [rows] = await executor.query(
      `SELECT id, periodo, scope, scope_id, question_id, n_respuestas,
              pct_positivo, pct_neutro, pct_negativo, promedio_norm, congelado_at
         FROM monthly_snapshots
        WHERE periodo = ? AND scope = ? AND scope_id = ?
          AND ${question_id === null ? 'question_id IS NULL' : 'question_id = ?'}
        LIMIT 1`,
      question_id === null ? [periodo, scope, scope_id] : [periodo, scope, scope_id, question_id]
    );
    return rows[0] ?? null;
  },

  async listByPeriodo(periodo, scope = null, executor = pool) {
    const where = ['periodo = ?'];
    const params = [periodo];
    if (scope) {
      where.push('scope = ?');
      params.push(scope);
    }
    const [rows] = await executor.query(
      `SELECT id, periodo, scope, scope_id, question_id, n_respuestas,
              pct_positivo, pct_neutro, pct_negativo, promedio_norm, congelado_at
         FROM monthly_snapshots
        WHERE ${where.join(' AND ')}
        ORDER BY scope, scope_id, question_id`,
      params
    );
    return rows;
  },

  async listHistory({ scope, scope_id, question_id = null, lookbackMonths = 12 }, executor = pool) {
    const [rows] = await executor.query(
      `SELECT periodo, n_respuestas, pct_positivo, pct_neutro, pct_negativo, promedio_norm, congelado_at
         FROM monthly_snapshots
        WHERE scope = ? AND scope_id = ?
          AND ${question_id === null ? 'question_id IS NULL' : 'question_id = ?'}
        ORDER BY periodo DESC
        LIMIT ?`,
      question_id === null
        ? [scope, scope_id, lookbackMonths]
        : [scope, scope_id, question_id, lookbackMonths]
    );
    return rows.reverse();
  },

  /**
   * Inserta de forma idempotente — si ya existe el snapshot para (periodo, scope, scope_id, question_id)
   * NO se sobreescribe. Esto refleja la regla de inmutabilidad del plan.
   * Devuelve { inserted: bool }.
   */
  async insertIfMissing(row, executor = pool) {
    const params = [
      row.periodo,
      row.scope,
      row.scope_id,
      row.question_id ?? null,
      row.n_respuestas,
      row.pct_positivo,
      row.pct_neutro,
      row.pct_negativo,
      row.promedio_norm
    ];
    const [result] = await executor.query(
      `INSERT IGNORE INTO monthly_snapshots
        (periodo, scope, scope_id, question_id, n_respuestas,
         pct_positivo, pct_neutro, pct_negativo, promedio_norm)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params
    );
    return { inserted: result.affectedRows > 0 };
  },

  async countPeriodo(periodo, executor = pool) {
    const [rows] = await executor.query(
      'SELECT COUNT(*) AS total FROM monthly_snapshots WHERE periodo = ?',
      [periodo]
    );
    return Number(rows[0]?.total ?? 0);
  }
};
