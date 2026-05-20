import { aiClassificationsRepo } from '../repositories/ai-classifications.repo.js';
import { questionsRepo } from '../repositories/questions.repo.js';
import { withTransaction } from '../db/pool.js';
import { procesarRetroactivamente } from './scoring.service.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

const POLARIDADES = new Set(['DIRECTA', 'INVERSA', 'NEUTRA']);

export async function listarPendientes() {
  return aiClassificationsRepo.listByEstado('PENDIENTE_REVISION');
}

/**
 * RRHH confirma o corrige la polaridad sugerida por Gemini. Si la pregunta
 * pasa a CONFIRMADA, se reprocesan retroactivamente las respuestas que
 * habían quedado EN_ESPERA.
 */
export async function confirmarPolaridad({ classificationId, polaridadFinal, usuarioId, accion = 'CONFIRMAR' }) {
  if (!POLARIDADES.has(polaridadFinal)) {
    throw new ValidationError('Polaridad inválida', [{ path: 'polaridadFinal', message: 'DIRECTA | INVERSA | NEUTRA' }]);
  }

  const clasificacion = await aiClassificationsRepo.findById(classificationId);
  if (!clasificacion) throw new NotFoundError('Clasificación no encontrada');
  if (clasificacion.estado !== 'PENDIENTE_REVISION') {
    throw new ValidationError('Esta clasificación ya fue resuelta');
  }

  const estadoClasificacion = accion === 'RECHAZAR'
    ? 'RECHAZADA'
    : (polaridadFinal === clasificacion.polaridad_sugerida ? 'CONFIRMADA' : 'CORREGIDA');

  await withTransaction(async (conn) => {
    await aiClassificationsRepo.confirmar(
      classificationId,
      {
        polaridad_final: polaridadFinal,
        confirmada_por: usuarioId,
        estado: estadoClasificacion
      },
      conn
    );
    if (clasificacion.question_id) {
      await questionsRepo.updatePolaridad(
        clasificacion.question_id,
        polaridadFinal,
        accion === 'RECHAZAR' ? 'PENDIENTE_REVISION' : 'CONFIRMADA',
        conn
      );
    }
  });

  let reproceso = { actualizadas: 0 };
  if (clasificacion.question_id && accion !== 'RECHAZAR') {
    reproceso = await procesarRetroactivamente(clasificacion.question_id);
  }
  return { estado: estadoClasificacion, polaridad: polaridadFinal, reproceso };
}
