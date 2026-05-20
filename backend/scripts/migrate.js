import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'db', 'migrations');

async function ensureDatabase() {
  const admin = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    multipleStatements: true
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(200) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function listPending(conn) {
  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const [applied] = await conn.query('SELECT filename FROM _migrations');
  const appliedSet = new Set(applied.map((r) => r.filename));
  return files.filter((f) => !appliedSet.has(f));
}

async function run() {
  await ensureDatabase();
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true
  });

  await ensureMigrationsTable(conn);
  const pending = await listPending(conn);

  if (!pending.length) {
    logger.info('Sin migraciones pendientes.');
    await conn.end();
    return;
  }

  for (const file of pending) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    logger.info({ file }, 'Aplicando migración');
    await conn.query(sql);
    await conn.query('INSERT INTO _migrations (filename) VALUES (?)', [file]);
  }

  await conn.end();
  logger.info({ count: pending.length }, 'Migraciones aplicadas');
}

run().catch((err) => {
  logger.error({ err }, 'Migrate falló');
  process.exit(1);
});
