import { pool, withTransaction, closePool } from '../src/db/pool.js';
import { dimensionsRepo } from '../src/repositories/dimensions.repo.js';
import { scalesRepo } from '../src/repositories/scales.repo.js';
import { surveyRunsRepo } from '../src/repositories/survey-runs.repo.js';
import { usersRepo } from '../src/repositories/users.repo.js';
import { hashPassword } from '../src/services/auth.service.js';
import { logger } from '../src/config/logger.js';

const DIMENSIONES = [
  { codigo: 'FILOSOFIA_Y_ESTRATEGIA', nombre: 'Filosofía y Estrategia', orden: 10 },
  { codigo: 'LIDERAZGO', nombre: 'Liderazgo', orden: 20 },
  { codigo: 'SOSTENIBILIDAD', nombre: 'Sostenibilidad', orden: 30 },
  { codigo: 'INNOVACION', nombre: 'Innovación', orden: 40 },
  { codigo: 'ORGANIZACION_DEL_TRABAJO', nombre: 'Organización del Trabajo', orden: 50 },
  { codigo: 'FORMACION_Y_DESARROLLO', nombre: 'Formación y Desarrollo', orden: 60 },
  { codigo: 'TRABAJO_EN_EQUIPO', nombre: 'Trabajo en Equipo', orden: 70 },
  { codigo: 'COMUNICACION', nombre: 'Comunicación', orden: 80 },
  { codigo: 'DESEMPENO', nombre: 'Desempeño', orden: 90 },
  { codigo: 'MOTIVACION', nombre: 'Motivación', orden: 100 },
  { codigo: 'CRECIMIENTO', nombre: 'Crecimiento', orden: 110 },
  { codigo: 'RECONOCIMIENTO', nombre: 'Reconocimiento', orden: 120 },
  { codigo: 'ORGULLO', nombre: 'Orgullo', orden: 130 },
  { codigo: 'SEGURIDAD', nombre: 'Seguridad', orden: 140 },
  { codigo: 'MEJORA_CONTINUA', nombre: 'Mejora Continua', orden: 150 },
  { codigo: 'DEMOGRAFICA', nombre: 'Demográficas', orden: 999 }
];

const ESCALAS = [
  {
    codigo: 'LIKERT_ACUERDO_5',
    nombre: 'Likert Acuerdo (5)',
    tipo: 'LIKERT',
    niveles: 5,
    opciones: [
      { etiqueta: 'Totalmente en desacuerdo', valor: 0 },
      { etiqueta: 'En desacuerdo', valor: 25 },
      { etiqueta: 'Indiferente', valor: 50 },
      { etiqueta: 'De acuerdo', valor: 75 },
      { etiqueta: 'Totalmente de acuerdo', valor: 100 }
    ]
  },
  {
    codigo: 'FRECUENCIA_5',
    nombre: 'Frecuencia (5)',
    tipo: 'FRECUENCIA',
    niveles: 5,
    opciones: [
      { etiqueta: 'Nunca', valor: 0 },
      { etiqueta: 'Rara vez', valor: 25 },
      { etiqueta: 'A veces', valor: 50 },
      { etiqueta: 'Casi siempre', valor: 75 },
      { etiqueta: 'Siempre', valor: 100 }
    ]
  },
  {
    codigo: 'COMPRENSION_5',
    nombre: 'Comprensión (5)',
    tipo: 'COMPRENSION',
    niveles: 5,
    opciones: [
      { etiqueta: 'No la conozco', valor: 0 },
      { etiqueta: 'Confuso', valor: 25 },
      { etiqueta: 'Algo enterado (a), pero no comprendo', valor: 50 },
      { etiqueta: 'Algo enterado (a) y comprendo', valor: 75 },
      { etiqueta: 'Enterado (a) y comprendo', valor: 100 }
    ]
  },
  {
    codigo: 'NIVEL_5',
    nombre: 'Nivel (5)',
    tipo: 'NIVEL',
    niveles: 5,
    opciones: [
      { etiqueta: 'Muy bajo', valor: 0 },
      { etiqueta: 'Bajo', valor: 25 },
      { etiqueta: 'Medio', valor: 50 },
      { etiqueta: 'Alto', valor: 75 },
      { etiqueta: 'Muy alto', valor: 100 }
    ]
  },
  {
    codigo: 'BINARIA_SI_NO',
    nombre: 'Sí / No',
    tipo: 'BINARIA',
    niveles: 2,
    opciones: [
      { etiqueta: 'No', valor: 0 },
      { etiqueta: 'Sí', valor: 100 }
    ]
  },
  {
    codigo: 'NUMERICA_1_10',
    nombre: 'Numérica 1-10',
    tipo: 'NIVEL',
    niveles: 10,
    opciones: null
  },
  {
    codigo: 'ABIERTA',
    nombre: 'Respuesta abierta',
    tipo: 'ABIERTA',
    niveles: null,
    opciones: null
  },
  {
    codigo: 'DEMOGRAFICA',
    nombre: 'Demográfica (no puntúa)',
    tipo: 'NIVEL',
    niveles: null,
    opciones: null
  }
];

async function upsertDimensions() {
  for (const d of DIMENSIONES) {
    if (!(await dimensionsRepo.findByCodigo(d.codigo))) {
      await dimensionsRepo.insert(d);
    }
  }
}

async function upsertScales() {
  for (const s of ESCALAS) {
    if (!(await scalesRepo.findByCodigo(s.codigo))) {
      await scalesRepo.insert(s);
    }
  }
}

async function upsertSurveyRun() {
  const codigo = 'clima-2024';
  if (await surveyRunsRepo.findByCodigo(codigo)) return;
  await surveyRunsRepo.insert({
    codigo,
    nombre: 'Encuesta Clima 2024',
    periodo: '2024',
    fecha_inicio: '2024-01-01',
    estado: 'ABIERTA'
  });
}

async function upsertAdmin() {
  const email = 'admin@pulsework.local';
  if (await usersRepo.findByEmail(email)) return;
  await usersRepo.insert({
    email,
    password_hash: await hashPassword('PulseWork#2024'),
    nombre: 'Administrador Cultura y Gente',
    role: 'ADMIN'
  });
  logger.warn({ email, defaultPassword: 'PulseWork#2024' }, 'Usuario admin creado. CAMBIAR contraseña.');
}

async function run() {
  await withTransaction(async () => {
    await upsertDimensions();
    await upsertScales();
    await upsertSurveyRun();
    await upsertAdmin();
  });
  logger.info('Seed base completado.');
}

run()
  .catch((err) => {
    logger.error({ err }, 'Seed falló');
    process.exitCode = 1;
  })
  .finally(closePool);
