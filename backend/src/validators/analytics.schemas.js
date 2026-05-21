import { z } from 'zod';

const periodoMes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato YYYY-MM');
const periodoAnio = z.string().regex(/^\d{4}$/, 'Formato YYYY');
const periodo = z.union([periodoMes, periodoAnio]);

export const aggregateScopeQuery = z.object({
  scope: z.enum(['COMPANY', 'DEPARTMENT']),
  scope_id: z.coerce.number().int().positive(),
  periodo
});

export const aggregateQuestionQuery = aggregateScopeQuery.extend({
  question_id: z.coerce.number().int().positive()
});

export const compareSelector = z.object({
  scope: z.enum(['COMPANY', 'DEPARTMENT']),
  scope_ids: z.string().transform((s) => s.split(',').map((x) => Number(x)).filter(Boolean))
    .pipe(z.array(z.number().int().positive()).min(1).max(3)),
  periodo
});

export const snapshotCloseBody = z.object({
  periodo: periodoMes
});

export const snapshotsListQuery = z.object({
  periodo: periodoMes,
  scope: z.enum(['COMPANY', 'DEPARTMENT', 'QUESTION_COMPANY', 'QUESTION_DEPARTMENT']).optional()
});

export const rankingQuery = z.object({
  tipo: z.enum(['GLOBAL', 'POR_PREGUNTA', 'POR_DIMENSION']),
  scope: z.enum(['COMPANY', 'DEPARTMENT']),
  periodo,
  question_id: z.coerce.number().int().positive().optional(),
  dimension_id: z.coerce.number().int().positive().optional()
});

export const alertsListQuery = z.object({
  periodo: periodoMes.optional(),
  nivel: z.enum(['VERDE', 'AMARILLO', 'ROJO', 'NEGRO']).optional(),
  atendida: z.enum(['true', 'false']).optional()
});

export const alertsRecalcBody = z.object({
  periodo: periodoMes
});

export const alertAtenderBody = z.object({
  notas: z.string().max(500).optional()
});

export const temporalQuery = z.object({
  scope: z.enum(['COMPANY', 'DEPARTMENT']),
  scope_id: z.coerce.number().int().positive(),
  periodo
});

export const cronicidadQuery = z.object({
  scope: z.enum(['COMPANY', 'DEPARTMENT']),
  scope_id: z.coerce.number().int().positive(),
  lookback_months: z.coerce.number().int().min(1).max(36).default(12)
});

export const historyQuery = z.object({
  scope: z.enum(['COMPANY', 'DEPARTMENT', 'QUESTION_COMPANY', 'QUESTION_DEPARTMENT']),
  scope_id: z.coerce.number().int().positive(),
  question_id: z.coerce.number().int().positive().optional(),
  lookback_months: z.coerce.number().int().min(1).max(36).default(12)
});
