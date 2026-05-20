import { z } from 'zod';

const periodo = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Formato YYYY-MM o YYYY');

export const generateSchema = z.object({
  scope: z.enum(['COMPANY', 'DEPARTMENT']),
  scope_id: z.coerce.number().int().positive(),
  periodo
});

export const previewQuerySchema = z.object({
  scope: z.enum(['COMPANY', 'DEPARTMENT']),
  scope_id: z.coerce.number().int().positive(),
  periodo
});
