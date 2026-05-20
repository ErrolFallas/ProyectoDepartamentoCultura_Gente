import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

export function notFound(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` }
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, route: req.originalUrl }, 'AppError 5xx');
    else logger.warn({ err: err.message, route: req.originalUrl, code: err.code }, 'AppError');
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details }
    });
  }
  logger.error({ err, route: req.originalUrl }, 'Error no controlado');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' }
  });
}
