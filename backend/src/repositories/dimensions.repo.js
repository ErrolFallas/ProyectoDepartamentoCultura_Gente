import { pool } from '../db/pool.js';

export const dimensionsRepo = {
  async findAll(executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, codigo, nombre, descripcion, orden FROM dimensions ORDER BY orden, nombre'
    );
    return rows;
  },

  async findByCodigo(codigo, executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, codigo, nombre FROM dimensions WHERE codigo = ? LIMIT 1',
      [codigo]
    );
    return rows[0] ?? null;
  },

  async insert({ codigo, nombre, descripcion, orden }, executor = pool) {
    const [result] = await executor.query(
      'INSERT INTO dimensions (codigo, nombre, descripcion, orden) VALUES (?, ?, ?, ?)',
      [codigo, nombre, descripcion ?? null, orden ?? 0]
    );
    return result.insertId;
  }
};
