import { pool } from '../db/pool.js';

export const departmentsRepo = {
  async findByCompany(companyId, executor = pool) {
    const [rows] = await executor.query(
      `SELECT id, company_id, nombre, activo
         FROM departments WHERE company_id = ? AND activo = 1 ORDER BY nombre`,
      [companyId]
    );
    return rows;
  },

  async findByNombre(companyId, nombre, executor = pool) {
    const [rows] = await executor.query(
      `SELECT id, company_id, nombre FROM departments
        WHERE company_id = ? AND nombre = ? LIMIT 1`,
      [companyId, nombre]
    );
    return rows[0] ?? null;
  },

  async upsertByNombre(companyId, nombre, executor = pool) {
    const existing = await this.findByNombre(companyId, nombre, executor);
    if (existing) return existing.id;
    const [result] = await executor.query(
      'INSERT INTO departments (company_id, nombre) VALUES (?, ?)',
      [companyId, nombre]
    );
    return result.insertId;
  }
};
