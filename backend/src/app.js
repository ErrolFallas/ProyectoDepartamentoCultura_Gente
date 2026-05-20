import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { logger } from './config/logger.js';

export function buildApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      // Para desarrollo: orígenes permitidos del SPA. En producción ajustar
      // a un dominio específico o detrás de un proxy con same-origin.
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const allow = [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
        if (allow.some((rx) => rx.test(origin))) return cb(null, true);
        return cb(new Error('CORS bloqueado'));
      },
      credentials: false,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Ingest-Token'],
      exposedHeaders: []
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(
    morgan('tiny', {
      stream: { write: (line) => logger.info(line.trim()) }
    })
  );

  // Rate limiting genérico para la API. Ingesta de n8n tiene su propio
  // límite separado (no queremos cortarle el flujo al worker).
  app.use(
    '/api/auth',
    rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false })
  );

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
