import { pool } from '../db/pool.js';

export const surveyRunsRepo = {
  async findActive(executor = pool) {
    const [rows] = await executor.query(
      `SELECT id, codigo, nombre, periodo, fecha_inicio, fecha_fin, estado
         FROM survey_runs WHERE estado = 'ABIERTA' ORDER BY fecha_inicio DESC LIMIT 1`
    );
    return rows[0] ?? null;
  },

  async findByCodigo(codigo, executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, codigo, periodo, estado FROM survey_runs WHERE codigo = ? LIMIT 1',
      [codigo]
    );
    return rows[0] ?? null;
  },

  async insert({ codigo, nombre, periodo, fecha_inicio, fecha_fin = null, estado = 'ABIERTA' }, executor = pool) {
    const [result] = await executor.query(
      `INSERT INTO survey_runs (codigo, nombre, periodo, fecha_inicio, fecha_fin, estado)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [codigo, nombre, periodo, fecha_inicio, fecha_fin, estado]
    );
    return result.insertId;
  }
};
