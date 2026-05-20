import { pool } from '../db/pool.js';

export const responsesRepo = {
  async findByHash(hash, executor = pool) {
    const [rows] = await executor.query(
      'SELECT id, source_row_hash FROM responses WHERE source_row_hash = ? LIMIT 1',
      [hash]
    );
    return rows[0] ?? null;
  },

  async insert({ survey_run_id, company_id, department_id, submitted_at, source_row_hash }, executor = pool) {
    const [result] = await executor.query(
      `INSERT INTO responses
        (survey_run_id, company_id, department_id, submitted_at, source_row_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [survey_run_id, company_id, department_id, submitted_at, source_row_hash]
    );
    return result.insertId;
  },

  async updateAggregate(id, { score_promedio, sentimiento }, executor = pool) {
    await executor.query(
      'UPDATE responses SET score_promedio = ?, sentimiento = ? WHERE id = ?',
      [score_promedio, sentimiento, id]
    );
  }
};
