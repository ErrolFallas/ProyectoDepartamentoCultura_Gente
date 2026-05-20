import { answersRepo } from '../repositories/answers.repo.js';
import { questionsRepo } from '../repositories/questions.repo.js';
import { responsesRepo } from '../repositories/responses.repo.js';
import { aplicarPolaridad, clasificarSentimiento, escalarLineal, round2 } from '../utils/normalize.js';
import { pool, withTransaction } from '../db/pool.js';
import { logger } from '../config/logger.js';

const NO_APLICA_TOKEN = 'NO_APLICA';

/**
 * Calcula el valor normalizado 0-100 de una respuesta cruda, considerando
 * el catálogo de opciones de la pregunta, su escala y polaridad.
 * Devuelve { valor_normalizado, sentimiento, estado, motivo_espera }.
 */
export async function puntuarValor({ question, opciones, valorCrudo }) {
  if (!question) {
    return { valor_normalizado: null, sentimiento: null, estado: 'EN_ESPERA', motivo_espera: 'PREGUNTA_DESCONOCIDA' };
  }

  if (question.estado !== 'CONFIRMADA') {
    return { valor_normalizado: null, sentimiento: null, estado: 'EN_ESPERA', motivo_espera: 'POLARIDAD_SIN_CONFIRMAR' };
  }

  if (question.scale_tipo === 'ABIERTA') {
    return { valor_normalizado: null, sentimiento: null, estado: 'TEXTO_ABIERTO' };
  }

  if (question.polaridad === 'NEUTRA') {
    return { valor_normalizado: null, sentimiento: null, estado: 'NO_APLICA' };
  }

  const valorLimpio = (valorCrudo ?? '').toString().trim();
  if (!valorLimpio) {
    return { valor_normalizado: null, sentimiento: null, estado: 'NO_APLICA' };
  }

  const opcion = matchOpcion(opciones, valorLimpio);
  if (opcion?.es_no_aplica) {
    return { valor_normalizado: null, sentimiento: null, estado: 'NO_APLICA' };
  }

  let valor0a100 = null;
  if (opcion && opcion.valor_normalizado !== null && opcion.valor_normalizado !== undefined) {
    valor0a100 = Number(opcion.valor_normalizado);
  } else if (Number.isFinite(Number(valorLimpio)) && question.scale_niveles) {
    valor0a100 = escalarLineal(Number(valorLimpio), question.scale_niveles);
  }

  if (valor0a100 === null) {
    return { valor_normalizado: null, sentimiento: null, estado: 'EN_ESPERA', motivo_espera: 'OPCION_DESCONOCIDA' };
  }

  const normalizado = aplicarPolaridad(valor0a100, question.polaridad);
  if (normalizado === null) {
    return { valor_normalizado: null, sentimiento: null, estado: 'NO_APLICA' };
  }

  const norm = round2(normalizado);
  return {
    valor_normalizado: norm,
    sentimiento: clasificarSentimiento(norm),
    estado: 'PUNTUADA'
  };
}

function matchOpcion(opciones, valorLimpio) {
  if (!opciones?.length) return null;
  const lower = valorLimpio.toLowerCase();
  if (lower === NO_APLICA_TOKEN.toLowerCase() || lower === 'no aplica') {
    return opciones.find((o) => o.es_no_aplica) ?? null;
  }
  return (
    opciones.find((o) => o.etiqueta?.toLowerCase() === lower) ??
    opciones.find((o) => o.valor_crudo && String(o.valor_crudo).toLowerCase() === lower) ??
    null
  );
}

/**
 * Recalcula el agregado de la respuesta (promedio + sentimiento global).
 * Sólo se promedian answers PUNTUADA (descarta NO_APLICA y EN_ESPERA).
 */
export async function recalcularAgregadoRespuesta(responseId, executor = pool) {
  const answers = await answersRepo.listByResponse(responseId, executor);
  const puntuadas = answers.filter((a) => a.estado === 'PUNTUADA' && a.valor_normalizado !== null);

  if (!puntuadas.length) {
    await responsesRepo.updateAggregate(responseId, { score_promedio: null, sentimiento: 'EN_ESPERA' }, executor);
    return { score_promedio: null, sentimiento: 'EN_ESPERA' };
  }

  const promedio = round2(
    puntuadas.reduce((sum, a) => sum + Number(a.valor_normalizado), 0) / puntuadas.length
  );
  const sentimiento = clasificarSentimiento(promedio);
  await responsesRepo.updateAggregate(responseId, { score_promedio: promedio, sentimiento }, executor);
  return { score_promedio: promedio, sentimiento };
}

/**
 * Procesa retroactivamente las answers EN_ESPERA de una pregunta recién
 * confirmada. Se llama cuando RRHH aprueba la polaridad sugerida por Gemini.
 */
export async function procesarRetroactivamente(questionId) {
  const question = await questionsRepo.findById(questionId);
  if (!question || question.estado !== 'CONFIRMADA') return { actualizadas: 0 };
  const opciones = await questionsRepo.findOptions(questionId);

  return withTransaction(async (conn) => {
    const pendientes = await answersRepo.listWaitingForQuestion(questionId, conn);
    const afectadasPorRespuesta = new Set();

    for (const ans of pendientes) {
      const scored = await puntuarValor({ question, opciones, valorCrudo: ans.valor_crudo });
      await answersRepo.updateScoring(
        ans.id,
        {
          valor_normalizado: scored.valor_normalizado,
          sentimiento: scored.sentimiento,
          estado: scored.estado
        },
        conn
      );
      afectadasPorRespuesta.add(ans.response_id);
    }

    for (const respId of afectadasPorRespuesta) {
      await recalcularAgregadoRespuesta(respId, conn);
    }

    logger.info(
      { questionId, actualizadas: pendientes.length, respuestas: afectadasPorRespuesta.size },
      'Procesamiento retroactivo completado'
    );

    return { actualizadas: pendientes.length, respuestas: afectadasPorRespuesta.size };
  });
}
