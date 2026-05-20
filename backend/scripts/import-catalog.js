import path from 'node:path';
import ExcelJS from 'exceljs';
import { pool, withTransaction, closePool } from '../src/db/pool.js';
import { dimensionsRepo } from '../src/repositories/dimensions.repo.js';
import { scalesRepo } from '../src/repositories/scales.repo.js';
import { questionsRepo } from '../src/repositories/questions.repo.js';
import { logger } from '../src/config/logger.js';

const DEFAULT_FILE = process.argv[2]
  ?? 'C:/Users/Estudiantes/Desktop/semana 17/materiales de departamento_cultura y gente/Encuesta Clima 2024.xlsx';
const DEFAULT_SHEET = process.argv[3] ?? 'PROPUESTA 2024';

const PATRONES_INVERSA = [
  /estr[eé]s/i, /renunci/i, /abandonar/i, /acoso/i, /maltrato/i,
  /burnout/i, /agotam/i, /frustrac/i, /malestar/i, /quejarse/i,
  /he pensado/i, /he sido v[ií]ctima/i
];

const DIM_CODIGOS = {
  'FILOSOFIA Y ESTRATEGIA': 'FILOSOFIA_Y_ESTRATEGIA',
  'LIDERAZGO': 'LIDERAZGO',
  'SOSTENIBILIDAD': 'SOSTENIBILIDAD',
  'INNOVACION': 'INNOVACION',
  'INNOVACIÓN': 'INNOVACION',
  'ORGANIZACION DEL TRABAJO': 'ORGANIZACION_DEL_TRABAJO',
  'ORGANIZACIÓN DEL TRABAJO': 'ORGANIZACION_DEL_TRABAJO',
  'FORMACION Y DESARROLLO': 'FORMACION_Y_DESARROLLO',
  'FORMACIÓN Y DESARROLLO': 'FORMACION_Y_DESARROLLO',
  'TRABAJO EN EQUIPO': 'TRABAJO_EN_EQUIPO',
  'COMUNICACION': 'COMUNICACION',
  'COMUNICACIÓN': 'COMUNICACION',
  'DESEMPENO': 'DESEMPENO',
  'DESEMPEÑO': 'DESEMPENO',
  'MOTIVACION': 'MOTIVACION',
  'MOTIVACIÓN': 'MOTIVACION',
  'CRECIMIENTO': 'CRECIMIENTO',
  'RECONOCIMIENTO': 'RECONOCIMIENTO',
  'ORGULLO': 'ORGULLO',
  'SEGURIDAD': 'SEGURIDAD',
  'MEJORA CONTINUA': 'MEJORA_CONTINUA',
  'DEMOGRAFICAS': 'DEMOGRAFICA',
  'DEMOGRÁFICAS': 'DEMOGRAFICA'
};

function normalizar(text) {
  return (text ?? '').toString().trim();
}

function parseJsonColumn(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value; // mysql2 ya lo devolvió como objeto
}

function detectarEscala(opciones) {
  const lower = opciones.map((o) => o.toLowerCase());
  const has = (substr) => lower.some((l) => l.includes(substr));

  if (has('no la conozco') || has('algo enterado')) return 'COMPRENSION_5';
  if (has('totalmente en desacuerdo') || has('totalmente de acuerdo')) return 'LIKERT_ACUERDO_5';
  if (has('nunca') && has('siempre')) return 'FRECUENCIA_5';
  if (lower.length === 2 && has('sí') && has('no')) return 'BINARIA_SI_NO';
  if (has('muy bajo') || has('muy alto')) return 'NIVEL_5';
  return 'DEMOGRAFICA';
}

function detectarPolaridad({ texto, dimensionCodigo, escalaCodigo }) {
  if (dimensionCodigo === 'DEMOGRAFICA' || escalaCodigo === 'DEMOGRAFICA') return 'NEUTRA';
  if (PATRONES_INVERSA.some((rx) => rx.test(texto))) return 'INVERSA';
  return 'DIRECTA';
}

function parseSheet(ws) {
  const items = [];
  let current = null;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 6) return; // encabezados/instrucciones
    const num = row.getCell(1).value;
    const cell2 = normalizar(row.getCell(2).value);
    const cell3 = normalizar(row.getCell(3).value);
    const cell4 = normalizar(row.getCell(4).value);

    const esEncabezadoPregunta = num !== null && num !== undefined && num !== '' && cell2;

    if (esEncabezadoPregunta) {
      if (current) items.push(current);
      current = {
        numero: Number(num) || items.length + 1,
        texto: cell2,
        dimension: cell3 || null,
        subdimension: cell4 || null,
        opciones: []
      };
    } else if (current && cell2) {
      current.opciones.push(cell2);
    }
  });

  if (current) items.push(current);
  return items;
}

async function importar({ filePath, sheetName }) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error(`Hoja '${sheetName}' no encontrada en ${filePath}`);

  const items = parseSheet(ws);
  logger.info({ total: items.length, sheet: sheetName }, 'Preguntas detectadas en Excel');

  const escalasCache = new Map();
  const dimensionesCache = new Map();
  let creadas = 0;
  let existentes = 0;

  await withTransaction(async (conn) => {
    for (const item of items) {
      const dimensionCodigo = DIM_CODIGOS[(item.dimension ?? '').toUpperCase()] ?? null;
      let dimensionId = null;
      if (dimensionCodigo) {
        if (!dimensionesCache.has(dimensionCodigo)) {
          const d = await dimensionsRepo.findByCodigo(dimensionCodigo, conn);
          if (d) dimensionesCache.set(dimensionCodigo, d.id);
        }
        dimensionId = dimensionesCache.get(dimensionCodigo) ?? null;
      }

      const escalaCodigo = detectarEscala(item.opciones);
      if (!escalasCache.has(escalaCodigo)) {
        const s = await scalesRepo.findByCodigo(escalaCodigo, conn);
        if (!s) throw new Error(`Escala '${escalaCodigo}' no existe. Ejecutar seed primero.`);
        escalasCache.set(escalaCodigo, s);
      }
      const escala = escalasCache.get(escalaCodigo);

      const polaridad = detectarPolaridad({
        texto: item.texto,
        dimensionCodigo,
        escalaCodigo
      });

      const yaExiste = await questionsRepo.findByTexto(item.texto, conn);
      if (yaExiste) {
        existentes += 1;
        continue;
      }

      const codigo = `clima2024_${String(item.numero).padStart(3, '0')}`;
      const questionId = await questionsRepo.insert(
        {
          codigo,
          texto: item.texto,
          dimension_id: dimensionId,
          subdimension: item.subdimension,
          scale_id: escala.id,
          polaridad,
          // El instrumento existente es el catálogo de referencia → CONFIRMADA.
          // Las nuevas preguntas que entren por Forms quedarán PENDIENTE_REVISION.
          estado: 'CONFIRMADA',
          origen: 'CATALOGO'
        },
        conn
      );

      const opcionesEscalaBase = parseJsonColumn(escala.opciones_json);
      const opciones = item.opciones.length
        ? item.opciones
        : (opcionesEscalaBase ? opcionesEscalaBase.map((o) => o.etiqueta) : []);

      const valoresEscalaBase = opcionesEscalaBase;

      for (let i = 0; i < opciones.length; i += 1) {
        const etiqueta = opciones[i];
        const esNoAplica = /^no aplica$/i.test(etiqueta);
        let valorNorm = null;
        if (!esNoAplica && polaridad !== 'NEUTRA') {
          const match = valoresEscalaBase?.find((o) => o.etiqueta?.toLowerCase() === etiqueta.toLowerCase());
          let valor0a100 = match ? Number(match.valor) : null;
          if (valor0a100 === null && escala.niveles) {
            valor0a100 = (i / (escala.niveles - 1)) * 100;
          }
          if (valor0a100 !== null) {
            valorNorm = polaridad === 'INVERSA' ? 100 - valor0a100 : valor0a100;
          }
        }
        await questionsRepo.insertOption(
          {
            question_id: questionId,
            etiqueta,
            valor_crudo: null,
            valor_normalizado: valorNorm,
            orden: i + 1,
            es_no_aplica: esNoAplica
          },
          conn
        );
      }

      creadas += 1;
    }
  });

  logger.info({ creadas, existentes }, 'Importación de catálogo terminada');
}

importar({ filePath: path.resolve(DEFAULT_FILE), sheetName: DEFAULT_SHEET })
  .catch((err) => {
    logger.error({ err }, 'Importación de catálogo falló');
    process.exitCode = 1;
  })
  .finally(closePool);
