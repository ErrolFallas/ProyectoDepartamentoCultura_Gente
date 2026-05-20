import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { logger } from './config/logger.js';

export function buildApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
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
