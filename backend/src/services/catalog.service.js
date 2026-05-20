import { questionsRepo } from '../repositories/questions.repo.js';
import { dimensionsRepo } from '../repositories/dimensions.repo.js';
import { scalesRepo } from '../repositories/scales.repo.js';
import { aiClassificationsRepo } from '../repositories/ai-classifications.repo.js';
import { geminiService } from './gemini.service.js';

/**
 * Resuelve la pregunta en el catálogo. Si no existe, la registra como
 * PENDIENTE_REVISION con la polaridad sugerida por Gemini.
 * Las respuestas asociadas a esa pregunta quedarán EN_ESPERA hasta
 * que RRHH confirme la polaridad.
 */
export async function asegurarPreguntaEnCatalogo({ texto, escala = null }, executor) {
  const existente = await questionsRepo.findByTexto(texto, executor);
  if (existente) return existente;

  const escalaCatalogo = await resolverEscala(escala, executor);
  const sugerencia = await geminiService.clasificarPolaridad({
    texto,
    escalaTipo: escalaCatalogo?.tipo
  });

  const codigo = `auto_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newId = await questionsRepo.insert(
    {
      codigo,
      texto,
      dimension_id: null,
      subdimension: sugerencia.dimension ?? null,
      scale_id: escalaCatalogo.id,
      polaridad: sugerencia.polaridad,
      estado: 'PENDIENTE_REVISION',
      origen: 'FORMS'
    },
    executor
  );

  await aiClassificationsRepo.insert(
    {
      question_id: newId,
      texto_pregunta: texto,
      polaridad_sugerida: sugerencia.polaridad,
      dimension_sugerida: sugerencia.dimension,
      razon: sugerencia.razon,
      confianza: sugerencia.confianza,
      modelo: sugerencia.modelo,
      estado: 'PENDIENTE_REVISION'
    },
    executor
  );

  return questionsRepo.findById(newId, executor);
}

async function resolverEscala(hint, executor) {
  if (!hint) return scalesRepo.findByCodigo('LIKERT_ACUERDO_5', executor);
  if (typeof hint === 'object' && hint.id) return hint;
  if (typeof hint === 'string') {
    const byCode = await scalesRepo.findByCodigo(hint, executor);
    if (byCode) return byCode;
  }
  return scalesRepo.findByCodigo('LIKERT_ACUERDO_5', executor);
}

export async function listarPendientesRevision() {
  return questionsRepo.listByEstado('PENDIENTE_REVISION');
}

export async function listarDimensiones() {
  return dimensionsRepo.findAll();
}

export async function listarEscalas() {
  return scalesRepo.findAll();
}
