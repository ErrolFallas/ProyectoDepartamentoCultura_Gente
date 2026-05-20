import { pool } from '../db/pool.js';

export const questionsRepo = {
  async findByTexto(texto, executor = pool) {
    const [rows] = await executor.query(
      `SELECT q.id, q.codigo, q.texto, q.dimension_id, q.subdimension,
              q.scale_id, q.polaridad, q.estado, q.origen, q.activa,
              s.tipo AS scale_tipo, s.niveles AS scale_niveles,
              s.opciones_json AS scale_opciones_json
         FROM questions q
         JOIN scales s ON s.id = q.scale_id
        WHERE q.texto = ? LIMIT 1`,
      [texto]
    );
    return rows[0] ?? null;
  },

  async findById(id, executor = pool) {
    const [rows] = await executor.query(
      `SELECT q.id, q.codigo, q.texto, q.dimension_id, q.subdimension,
              q.scale_id, q.polaridad, q.estado, q.origen, q.activa,
              s.tipo AS scale_tipo, s.niveles AS scale_niveles,
              s.opciones_json AS scale_opciones_json
         FROM questions q
         JOIN scales s ON s.id = q.scale_id
        WHERE q.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async listByEstado(estado, executor = pool) {
    const [rows] = await executor.query(
      `SELECT q.id, q.codigo, q.texto, q.dimension_id, q.subdimension,
              q.scale_id, q.polaridad, q.estado, q.origen, q.activa,
              s.tipo AS scale_tipo, s.niveles AS scale_niveles
         FROM questions q
         JOIN scales s ON s.id = q.scale_id
        WHERE q.estado = ?
        ORDER BY q.created_at DESC`,
      [estado]
    );
    return rows;
  },

  async insert({ codigo, texto, dimension_id, subdimension, scale_id, polaridad, estado, origen }, executor = pool) {
    const [result] = await executor.query(
      `INSERT INTO questions (codigo, texto, dimension_id, subdimension, scale_id, polaridad, estado, origen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, texto, dimension_id, subdimension, scale_id, polaridad, estado, origen]
    );
    return result.insertId;
  },

  async updatePolaridad(id, polaridad, estado, executor = pool) {
    await executor.query(
      'UPDATE questions SET polaridad = ?, estado = ? WHERE id = ?',
      [polaridad, estado, id]
    );
  },

  async findOptions(questionId, executor = pool) {
    const [rows] = await executor.query(
      `SELECT id, etiqueta, valor_crudo, valor_normalizado, orden, es_no_aplica
         FROM question_options WHERE question_id = ? ORDER BY orden, id`,
      [questionId]
    );
    return rows;
  },

  async insertOption({ question_id, etiqueta, valor_crudo, valor_normalizado, orden, es_no_aplica }, executor = pool) {
    const [result] = await executor.query(
      `INSERT INTO question_options (question_id, etiqueta, valor_crudo, valor_normalizado, orden, es_no_aplica)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [question_id, etiqueta, valor_crudo, valor_normalizado, orden, es_no_aplica ? 1 : 0]
    );
    return result.insertId;
  }
};
