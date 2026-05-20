import { pool } from '../db/pool.js';
import { geminiService } from './gemini.service.js';

/**
 * Persiste el análisis de texto abierto asociado a la answer del response.
 * No atribuye la frase a una persona: solo guarda tono y temas detectados.
 */
export async function analizarYPersistirTextoAbierto({ responseId, pregunta, valor }) {
  const [[answer]] = await pool.query(
    'SELECT id FROM answers WHERE response_id = ? AND question_id = ? LIMIT 1',
    [responseId, pregunta.id]
  );
  if (!answer) return null;

  const analisis = await geminiService.analizarTextoAbierto({ texto: valor });

  await pool.query(
    `INSERT INTO open_text_analysis (answer_id, tono, temas, modelo, score_confianza)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tono = VALUES(tono),
         temas = VALUES(temas),
         modelo = VALUES(modelo),
         score_confianza = VALUES(score_confianza)`,
    [
      answer.id,
      analisis.tono,
      JSON.stringify(analisis.temas ?? []),
      analisis.modelo,
      analisis.score_confianza ?? null
    ]
  );

  return analisis;
}
