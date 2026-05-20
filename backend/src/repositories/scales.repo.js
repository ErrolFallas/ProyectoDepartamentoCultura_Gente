import { pool } from '../db/pool.js';

export const scalesRepo = {
  async findAll(executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, codigo, nombre, tipo, niveles, opciones_json, descripcion FROM scales ORDER BY id'
    );
    return rows;
  },

  async findByCodigo(codigo, executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, codigo, nombre, tipo, niveles, opciones_json, descripcion FROM scales WHERE codigo = ? LIMIT 1',
      [codigo]
    );
    return rows[0] ?? null;
  },

  async insert({ codigo, nombre, tipo, niveles, opciones, descripcion }, executor = pool) {
    const [result] = await executor.query(
      `INSERT INTO scales (codigo, nombre, tipo, niveles, opciones_json, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        codigo,
        nombre,
        tipo,
        niveles ?? null,
        opciones ? JSON.stringify(opciones) : null,
        descripcion ?? null
      ]
    );
    return result.insertId;
  }
};
