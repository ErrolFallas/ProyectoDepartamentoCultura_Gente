import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closePool, ping } from './db/pool.js';

async function bootstrap() {
  const dbUp = await ping().catch((err) => {
    logger.error({ err: err.message }, 'No se pudo conectar a MySQL');
    return false;
  });
  if (!dbUp) {
    logger.warn('Iniciando backend sin conexión MySQL verificada. Revisar credenciales en .env.');
  }

  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Garnier PulseWork backend escuchando en :${env.PORT} [${env.NODE_ENV}]`);
  });

  const shutdown = (signal) => async () => {
    logger.info({ signal }, 'Cerrando servidor');
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };

  process.on('SIGINT', shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fallo crítico en bootstrap');
  process.exit(1);
});
