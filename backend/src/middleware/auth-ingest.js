import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Middleware exclusivo para llamadas de n8n al endpoint de ingesta.
 * n8n NUNCA escribe a MySQL; solo POSTea filas nuevas con este token.
 */
export function requireIngestToken(req, _res, next) {
  const provided =
    req.headers['x-ingest-token'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!provided || provided !== env.N8N_INGEST_TOKEN) {
    return next(new UnauthorizedError('Token de ingesta inválido'));
  }
  next();
}
