import { pool } from '../db/pool.js';

export const answersRepo = {
  async insert(rows, executor = pool) {
    if (!rows.length) return;
    const values = rows.map((r) => [
      r.response_id,
      r.question_id,
      r.valor_crudo,
      r.valor_normalizado,
      r.sentimiento,
      r.estado,
      r.motivo_espera ?? null,
      r.scored_at ?? null
    ]);
    await executor.query(
      `INSERT INTO answers
        (response_id, question_id, valor_crudo, valor_normalizado, sentimiento, estado, motivo_espera, scored_at)
       VALUES ?`,
      [values]
    );
  },

  async listByResponse(responseId, executor = pool) {
    const [rows] = await executor.query(
      `SELECT id, response_id, question_id, valor_crudo, valor_normalizado,
              sentimiento, estado, motivo_espera, scored_at
         FROM answers WHERE response_id = ? ORDER BY id`,
      [responseId]
    );
    return rows;
  },

  async listWaitingForQuestion(questionId, executor = pool) {
    const [rows] = await executor.query(
      `SELECT id, response_id, question_id, valor_crudo
         FROM answers
        WHERE question_id = ? AND estado = 'EN_ESPERA'`,
      [questionId]
    );
    return rows;
  },

  async updateScoring(id, { valor_normalizado, sentimiento, estado }, executor = pool) {
    await executor.query(
      `UPDATE answers
          SET valor_normalizado = ?, sentimiento = ?, estado = ?, scored_at = NOW(), motivo_espera = NULL
        WHERE id = ?`,
      [valor_normalizado, sentimiento, estado, id]
    );
  }
};
