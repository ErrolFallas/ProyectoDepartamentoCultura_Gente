import { pool } from '../db/pool.js';

export const ingestLogRepo = {
  async insert({ source_row_hash, estado, error, payload_sample }, executor = pool) {
    await executor.query(
      `INSERT INTO ingest_log (source_row_hash, estado, error, payload_sample)
       VALUES (?, ?, ?, ?)`,
      [source_row_hash, estado, error ?? null, payload_sample ? JSON.stringify(payload_sample) : null]
    );
  }
};
