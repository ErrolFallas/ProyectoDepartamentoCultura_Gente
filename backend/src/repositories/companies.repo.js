import { pool } from '../db/pool.js';

export const companiesRepo = {
  async findAll(executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, nombre, codigo, activo FROM companies WHERE activo = 1 ORDER BY nombre'
    );
    return rows;
  },

  async findByNombre(nombre, executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, nombre FROM companies WHERE nombre = ? LIMIT 1',
      [nombre]
    );
    return rows[0] ?? null;
  },

  async upsertByNombre(nombre, executor = pool) {
    const existing = await this.findByNombre(nombre, executor);
    if (existing) return existing.id;
    const [result] = await executor.query(
      'INSERT INTO companies (nombre) VALUES (?)',
      [nombre]
    );
    return result.insertId;
  }
};
