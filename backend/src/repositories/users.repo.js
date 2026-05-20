import { pool } from '../db/pool.js';

export const usersRepo = {
  async findByEmail(email, executor = pool) {
    const [rows] = await executor.query(
      `SELECT id, email, password_hash, nombre, role, activo
         FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    return rows[0] ?? null;
  },

  async findById(id, executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, email, nombre, role, activo FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] ?? null;
  },

  async insert({ email, password_hash, nombre, role = 'ANALISTA' }, executor = pool) {
    const [result] = await executor.query(
      `INSERT INTO users (email, password_hash, nombre, role)
       VALUES (?, ?, ?, ?)`,
      [email, password_hash, nombre, role]
    );
    return result.insertId;
  },

  async markLogin(id, executor = pool) {
    await executor.query('UPDATE users SET ultimo_login_at = NOW() WHERE id = ?', [id]);
  }
};
