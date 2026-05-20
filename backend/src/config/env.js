import { config } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  BACKEND_BASE_URL: z.string().url().default('http://localhost:3000'),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('garnier_pulsework'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),

  MS_CLIENT_ID: z.string().optional().default(''),
  MS_CLIENT_SECRET: z.string().optional().default(''),
  MS_TENANT_ID: z.string().optional().default(''),
  MS_DRIVE_ITEM_ID: z.string().optional().default(''),

  N8N_INGEST_TOKEN: z.string().min(16, 'N8N_INGEST_TOKEN debe tener al menos 16 caracteres'),

  MIN_RESPUESTAS_DEPARTAMENTO: z.coerce.number().int().min(1).default(5),
  UMBRAL_NEGATIVO_MAX: z.coerce.number().min(0).max(100).default(40),
  UMBRAL_NEUTRO_MAX: z.coerce.number().min(0).max(100).default(60),
  SEMAFORO_AMARILLO_MIN: z.coerce.number().min(0).max(100).default(40),
  SEMAFORO_ROJO_MIN: z.coerce.number().min(0).max(100).default(75)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuración inválida:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
