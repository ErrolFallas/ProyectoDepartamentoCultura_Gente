import { z } from 'zod';

export const confirmarClasificacionSchema = z.object({
  polaridad_final: z.enum(['DIRECTA', 'INVERSA', 'NEUTRA']),
  accion: z.enum(['CONFIRMAR', 'CORREGIR', 'RECHAZAR']).default('CONFIRMAR')
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
