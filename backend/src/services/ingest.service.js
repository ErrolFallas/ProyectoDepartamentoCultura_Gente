import { withTransaction } from '../db/pool.js';
import { companiesRepo } from '../repositories/companies.repo.js';
import { departmentsRepo } from '../repositories/departments.repo.js';
import { responsesRepo } from '../repositories/responses.repo.js';
import { answersRepo } from '../repositories/answers.repo.js';
import { surveyRunsRepo } from '../repositories/survey-runs.repo.js';
import { questionsRepo } from '../repositories/questions.repo.js';
import { ingestLogRepo } from '../repositories/ingest-log.repo.js';
import { analizarYPersistirTextoAbierto } from './open-text.service.js';
import { asegurarPreguntaEnCatalogo } from './catalog.service.js';
import { puntuarValor, recalcularAgregadoRespuesta } from './scoring.service.js';
import { sourceRowHash } from '../utils/hash.js';
import { ValidationError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

const SUBMIT_TS_FALLBACK = () => new Date();

/**
 * Punto único por donde entran las filas anónimas que recolecta n8n del
 * Excel vinculado a Microsoft Forms. Procesa una fila a la vez para que
 * un fallo no contamine el lote completo.
 */
export async function ingestRow(row, { surveyRunId } = {}) {
  validarFila(row);
  const submittedAt = parseSubmittedAt(row.submitted_at);
  const respuestasArray = Array.isArray(row.answers) ? row.answers : [];
  const hash = sourceRowHash({
    submittedAt: submittedAt.toISOString(),
    company: row.company,
    department: row.department,
    answers: respuestasArray
  });

  const existente = await responsesRepo.findByHash(hash);
  if (existente) {
    await ingestLogRepo.insert({ source_row_hash: hash, estado: 'DUPLICADO' });
    return { status: 'DUPLICADO', responseId: existente.id, hash };
  }

  try {
    const result = await withTransaction(async (conn) => {
      const companyId = await companiesRepo.upsertByNombre(row.company, conn);
      const departmentId = await departmentsRepo.upsertByNombre(companyId, row.department, conn);

      const runId = surveyRunId ?? (await resolveSurveyRun(conn));

      const responseId = await responsesRepo.insert(
        {
          survey_run_id: runId,
          company_id: companyId,
          department_id: departmentId,
          submitted_at: submittedAt,
          source_row_hash: hash
        },
        conn
      );

      const answerRows = [];
      const aberturaTexto = [];

      for (const item of respuestasArray) {
        const texto = (item.question ?? '').toString().trim();
        if (!texto) continue;

        const pregunta = await asegurarPreguntaEnCatalogo(
          { texto, escala: item.scale ?? null },
          conn
        );
        const opciones = await questionsRepo.findOptions(pregunta.id, conn);

        const scored = await puntuarValor({
          question: pregunta,
          opciones,
          valorCrudo: item.value
        });

        answerRows.push({
          response_id: responseId,
          question_id: pregunta.id,
          valor_crudo: item.value ?? null,
          valor_normalizado: scored.valor_normalizado,
          sentimiento: scored.sentimiento,
          estado: scored.estado,
          motivo_espera: scored.motivo_espera,
          scored_at: scored.estado === 'PUNTUADA' ? new Date() : null
        });

        if (pregunta.scale_tipo === 'ABIERTA' && item.value) {
          aberturaTexto.push({ pregunta, valor: item.value });
        }
      }

      await answersRepo.insert(answerRows, conn);
      await recalcularAgregadoRespuesta(responseId, conn);

      return { responseId, aberturaTexto };
    });

    // Análisis de texto abierto fuera de la transacción: no debe bloquear ingesta.
    if (result.aberturaTexto.length) {
      for (const t of result.aberturaTexto) {
        try {
          await analizarYPersistirTextoAbierto({ responseId: result.responseId, pregunta: t.pregunta, valor: t.valor });
        } catch (err) {
          logger.warn({ err: err.message }, 'Falló análisis de texto abierto');
        }
      }
    }

    await ingestLogRepo.insert({ source_row_hash: hash, estado: 'OK' });
    return { status: 'OK', responseId: result.responseId, hash };
  } catch (err) {
    await ingestLogRepo.insert({
      source_row_hash: hash,
      estado: 'ERROR',
      error: (err.message ?? '').slice(0, 500),
      payload_sample: { company: row.company, department: row.department }
    });
    throw err;
  }
}

function validarFila(row) {
  const detalles = [];
  if (!row?.company) detalles.push({ path: 'company', message: 'requerido' });
  if (!row?.department) detalles.push({ path: 'department', message: 'requerido' });
  if (!Array.isArray(row?.answers)) detalles.push({ path: 'answers', message: 'debe ser un arreglo' });
  if (detalles.length) throw new ValidationError('Fila inválida', detalles);
}

function parseSubmittedAt(value) {
  if (!value) return SUBMIT_TS_FALLBACK();
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : SUBMIT_TS_FALLBACK();
}

async function resolveSurveyRun(executor) {
  const activo = await surveyRunsRepo.findActive(executor);
  if (activo) return activo.id;
  const year = new Date().getFullYear();
  const codigo = `auto-${year}`;
  return (
    (await surveyRunsRepo.findByCodigo(codigo, executor))?.id ??
    (await surveyRunsRepo.insert(
      {
        codigo,
        nombre: `Encuesta ${year}`,
        periodo: String(year),
        fecha_inicio: `${year}-01-01`,
        estado: 'ABIERTA'
      },
      executor
    ))
  );
}

export async function ingestBatch(rows, opts) {
  const out = { received: rows.length, ok: 0, duplicates: 0, errors: 0, errorsDetail: [] };
  for (const row of rows) {
    try {
      const r = await ingestRow(row, opts);
      if (r.status === 'OK') out.ok += 1;
      else if (r.status === 'DUPLICADO') out.duplicates += 1;
    } catch (err) {
      out.errors += 1;
      out.errorsDetail.push({ message: err.message ?? 'desconocido' });
      logger.warn({ err: err.message }, 'Fila de ingesta falló');
    }
  }
  return out;
}
