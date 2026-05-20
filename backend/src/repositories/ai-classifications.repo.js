import { pool } from '../db/pool.js';

export const aiClassificationsRepo = {
  async listByEstado(estado, executor = pool) {
    const [rows] = await executor.query(
      `SELECT id, question_id, texto_pregunta, polaridad_sugerida, dimension_sugerida,
              razon, confianza, modelo, estado, confirmada_por, confirmada_at,
              polaridad_final, created_at
         FROM ai_classifications WHERE estado = ? ORDER BY created_at DESC`,
      [estado]
    );
    return rows;
  },

  async findById(id, executor = pool) {
    const [rows] = await executor.query(
      'SELECT * FROM ai_classifications WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] ?? null;
  },

  async insert(data, executor = pool) {
    const [result] = await executor.query(
      `INSERT INTO ai_classifications
        (question_id, texto_pregunta, polaridad_sugerida, dimension_sugerida,
         razon, confianza, modelo, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.question_id ?? null,
        data.texto_pregunta,
        data.polaridad_sugerida,
        data.dimension_sugerida ?? null,
        data.razon ?? null,
        data.confianza ?? null,
        data.modelo ?? null,
        data.estado ?? 'PENDIENTE_REVISION'
      ]
    );
    return result.insertId;
  },

  async confirmar(id, { polaridad_final, confirmada_por, estado = 'CONFIRMADA' }, executor = pool) {
    await executor.query(
      `UPDATE ai_classifications
          SET estado = ?, polaridad_final = ?, confirmada_por = ?, confirmada_at = NOW()
        WHERE id = ?`,
      [estado, polaridad_final, confirmada_por, id]
    );
  }
};
