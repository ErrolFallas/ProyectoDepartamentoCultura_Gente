import { pool } from '../db/pool.js';

export const alertsRepo = {
  async list({ periodo = null, nivel = null, atendida = null } = {}, executor = pool) {
    const where = [];
    const params = [];
    if (periodo) { where.push('a.periodo = ?'); params.push(periodo); }
    if (nivel)   { where.push('a.nivel = ?'); params.push(nivel); }
    if (atendida !== null) { where.push('a.atendida = ?'); params.push(atendida ? 1 : 0); }

    const [rows] = await executor.query(
      `SELECT a.id, a.department_id, d.nombre AS departamento, d.company_id,
              c.nombre AS empresa, a.periodo, a.pct_negativo, a.nivel,
              a.atendida, a.atendida_por, a.atendida_at, a.notas, a.created_at
         FROM alerts a
         JOIN departments d ON d.id = a.department_id
         JOIN companies c ON c.id = d.company_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY FIELD(a.nivel, 'NEGRO', 'ROJO', 'AMARILLO', 'VERDE'), a.pct_negativo DESC`,
      params
    );
    return rows;
  },

  /**
   * Upsert por (department_id, periodo). Si ya existe se actualiza el nivel y
   * el porcentaje pero se preserva atendida/atendida_por/atendida_at.
   */
  async upsert({ department_id, periodo, pct_negativo, nivel }, executor = pool) {
    await executor.query(
      `INSERT INTO alerts (department_id, periodo, pct_negativo, nivel)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         pct_negativo = VALUES(pct_negativo),
         nivel = VALUES(nivel)`,
      [department_id, periodo, pct_negativo, nivel]
    );
  },

  async marcarAtendida({ id, usuarioId, notas }, executor = pool) {
    await executor.query(
      `UPDATE alerts
          SET atendida = 1, atendida_por = ?, atendida_at = NOW(), notas = ?
        WHERE id = ?`,
      [usuarioId, notas ?? null, id]
    );
  },

  async findById(id, executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, department_id, periodo, pct_negativo, nivel, atendida FROM alerts WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] ?? null;
  }
};
