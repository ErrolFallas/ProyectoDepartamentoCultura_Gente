import { pool } from '../db/pool.js';

export const rankingsRepo = {
  async findCached({ tipo, scope, periodo, question_id = null, dimension_id = null }, executor = pool) {
    const where = ['tipo = ?', 'scope = ?', 'periodo = ?'];
    const params = [tipo, scope, periodo];
    if (question_id) { where.push('question_id = ?'); params.push(question_id); }
    else where.push('question_id IS NULL');
    if (dimension_id) { where.push('dimension_id = ?'); params.push(dimension_id); }
    else where.push('dimension_id IS NULL');

    const [rows] = await executor.query(
      `SELECT id, tipo, scope, periodo, question_id, dimension_id,
              scope_id, posicion, valor, calculado_at
         FROM rankings_cache
        WHERE ${where.join(' AND ')}
        ORDER BY posicion ASC`,
      params
    );
    return rows;
  },

  async deleteWhere({ tipo, scope, periodo, question_id = null, dimension_id = null }, executor = pool) {
    const where = ['tipo = ?', 'scope = ?', 'periodo = ?'];
    const params = [tipo, scope, periodo];
    if (question_id) { where.push('question_id = ?'); params.push(question_id); }
    else where.push('question_id IS NULL');
    if (dimension_id) { where.push('dimension_id = ?'); params.push(dimension_id); }
    else where.push('dimension_id IS NULL');

    await executor.query(
      `DELETE FROM rankings_cache WHERE ${where.join(' AND ')}`,
      params
    );
  },

  async bulkInsert(rows, executor = pool) {
    if (!rows.length) return;
    const values = rows.map((r) => [
      r.tipo,
      r.scope,
      r.periodo,
      r.question_id ?? null,
      r.dimension_id ?? null,
      r.scope_id,
      r.posicion,
      r.valor
    ]);
    await executor.query(
      `INSERT INTO rankings_cache
        (tipo, scope, periodo, question_id, dimension_id, scope_id, posicion, valor)
       VALUES ?`,
      [values]
    );
  },

  async lastCalculatedAt({ tipo, scope, periodo, question_id = null, dimension_id = null }, executor = pool) {
    const [rows] = await executor.query(
      `SELECT MAX(calculado_at) AS at FROM rankings_cache
        WHERE tipo = ? AND scope = ? AND periodo = ?
          AND ${question_id ? 'question_id = ?' : 'question_id IS NULL'}
          AND ${dimension_id ? 'dimension_id = ?' : 'dimension_id IS NULL'}`,
      [tipo, scope, periodo, ...(question_id ? [question_id] : []), ...(dimension_id ? [dimension_id] : [])]
    );
    return rows[0]?.at ?? null;
  },

  async latestResponseCreatedAt(periodo, executor = pool) {
    const [rows] = await executor.query(
      `SELECT MAX(created_at) AS at FROM responses
        WHERE DATE_FORMAT(submitted_at, '%Y-%m') = ?`,
      [periodo]
    );
    return rows[0]?.at ?? null;
  }
};
