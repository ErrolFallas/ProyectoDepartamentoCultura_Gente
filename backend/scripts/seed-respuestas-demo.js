/**
 * Genera respuestas anónimas de demostración para que los paneles
 * (Asistente, Comparador, Semáforo, Tendencias) tengan datos antes
 * de conectar Microsoft Forms real.
 *
 * Reglas:
 *  - Usa el mismo pipeline real (ingestRow) → ejercita hash, scoring,
 *    polaridad y agregados.
 *  - Asume que el catálogo ya tiene preguntas CONFIRMADAS
 *    (correr antes `seed:catalog`).
 *  - Crea empresas/departamentos por nombre si no existen.
 *  - Modela perfiles intencionales para que el semáforo y la
 *    cronicidad muestren variedad.
 *
 * Uso:
 *   node backend/scripts/seed-respuestas-demo.js [--months 3] [--per-cell 6]
 */

import { closePool } from '../src/db/pool.js';
import { questionsRepo } from '../src/repositories/questions.repo.js';
import { ingestRow } from '../src/services/ingest.service.js';
import { logger } from '../src/config/logger.js';

const argv = parseArgs(process.argv.slice(2));

const CFG = {
  monthsBack: argv['months'] ?? 4,
  responsesPerCell: argv['per-cell'] ?? 7,
  questionsPerResponse: [6, 10],
  noiseRate: 0.2
};

const COMPANIES = ['GGDI', 'AVON'];

const DEPARTMENTS_BY_COMPANY = {
  GGDI: ['Operaciones', 'Tecnología', 'Comercial', 'Recursos Humanos', 'Finanzas', 'Logística'],
  AVON: ['Operaciones', 'Tecnología', 'Comercial', 'Recursos Humanos', 'Mercadeo']
};

const TEXTOS_POSITIVOS = [
  'Me siento orgulloso de mi equipo y de los logros recientes.',
  'El liderazgo es cercano y accesible, eso ayuda mucho.',
  'Buen ambiente, hay espacio para aportar ideas.',
  'Aprecio las oportunidades de aprendizaje y crecimiento.',
  'Las metas están claras y la comunicación es buena.'
];

const TEXTOS_NEUTROS = [
  'Hay cosas que se pueden mejorar, pero en general estable.',
  'A veces falta comunicación entre áreas.',
  'Las cargas de trabajo varían según el mes.',
  'Esperando ver mejoras en los procesos.',
  'En lo personal me siento bien, aunque podría haber más reconocimiento.'
];

const TEXTOS_NEGATIVOS = [
  'Mucha carga de trabajo, me siento agotado constantemente.',
  'La comunicación con la jefatura es deficiente y genera estrés.',
  'He pensado en buscar otras oportunidades por falta de reconocimiento.',
  'Hay malestar en el equipo, faltan espacios para ser escuchados.',
  'El ambiente se ha vuelto tenso en los últimos meses.'
];

async function main() {
  logger.info({ cfg: CFG }, 'Iniciando seed de respuestas demo');

  const questions = await questionsRepo.listByEstado('CONFIRMADA');
  if (!questions.length) {
    logger.error(
      'No hay preguntas con estado CONFIRMADA. Corré primero: npm --workspace backend run seed:catalog'
    );
    process.exitCode = 1;
    return;
  }

  const optionsByQuestion = new Map();
  for (const q of questions) {
    optionsByQuestion.set(q.id, await questionsRepo.findOptions(q.id));
  }

  const preguntasUsables = questions.filter((q) => {
    if (q.scale_tipo === 'ABIERTA') return true;
    return optionsByQuestion.get(q.id)?.length > 0;
  });

  logger.info(
    { confirmadas: questions.length, usables: preguntasUsables.length },
    'Catálogo cargado'
  );

  const resumen = { ok: 0, duplicados: 0, errores: 0 };

  for (let monthsAgo = CFG.monthsBack - 1; monthsAgo >= 0; monthsAgo -= 1) {
    for (const company of COMPANIES) {
      for (const department of DEPARTMENTS_BY_COMPANY[company]) {
        const stress = perfilEstres({ company, department, monthsAgo });
        for (let i = 0; i < CFG.responsesPerCell; i += 1) {
          try {
            const row = construirRespuesta({
              company,
              department,
              monthsAgo,
              stress,
              preguntas: preguntasUsables,
              optionsByQuestion
            });
            const result = await ingestRow(row);
            if (result.status === 'OK') resumen.ok += 1;
            else if (result.status === 'DUPLICADO') resumen.duplicados += 1;
          } catch (err) {
            resumen.errores += 1;
            logger.warn({ err: err.message, company, department }, 'Fila demo falló');
          }
        }
      }
    }
    logger.info({ mesAtras: monthsAgo, ...resumen }, 'Mes procesado');
  }

  logger.info(resumen, 'Seed demo terminado');
  logger.info({
    sugerencia:
      'Recalcular semáforo: POST /api/alerts/recalculate con periodo YYYY-MM, ' +
      'y cerrar snapshots: POST /api/snapshots/close para meses pasados.'
  });
}

// ---------------------------------------------------------------------
// Perfiles intencionales
// ---------------------------------------------------------------------
// stress ∈ [0,1]: 0 = depto feliz (todo positivo), 1 = depto en crisis.
// Algunos departamentos están preconfigurados para mostrar:
//   - GGDI / Finanzas: ROJO crónico (todos los meses).
//   - AVON / Comercial: VERDE constante.
//   - GGDI / Operaciones: empeoró progresivamente hacia el presente.
//   - AVON / Mercadeo: zona amarilla volátil.
// El resto fluctúa en torno a un baseline neutral con ruido.

function perfilEstres({ company, department, monthsAgo }) {
  const key = `${company}:${department}`;
  switch (key) {
    case 'GGDI:Finanzas':       return clamp(0.84 + jitter(0.04));
    case 'AVON:Comercial':      return clamp(0.16 + jitter(0.06));
    case 'GGDI:Operaciones':    return clamp(0.70 - monthsAgo * 0.10 + jitter(0.06));
    case 'AVON:Mercadeo':       return clamp(0.55 + jitter(0.15));
    case 'GGDI:Tecnología':     return clamp(0.30 + jitter(0.10));
    case 'AVON:Tecnología':     return clamp(0.40 + jitter(0.12));
    case 'GGDI:Recursos Humanos': return clamp(0.25 + jitter(0.08));
    case 'AVON:Recursos Humanos': return clamp(0.35 + jitter(0.10));
    case 'GGDI:Comercial':      return clamp(0.45 + jitter(0.15));
    case 'GGDI:Logística':      return clamp(0.50 + jitter(0.15));
    case 'AVON:Operaciones':    return clamp(0.42 + jitter(0.12));
    default:                    return clamp(0.45 + jitter(0.20));
  }
}

function construirRespuesta({ company, department, monthsAgo, stress, preguntas, optionsByQuestion }) {
  const submitted = fechaAleatoriaEnMes(monthsAgo);
  const muestra = elegirAlAzar(preguntas, randInt(CFG.questionsPerResponse[0], CFG.questionsPerResponse[1]));

  const answers = [];
  for (const q of muestra) {
    const value = elegirValor({
      pregunta: q,
      opciones: optionsByQuestion.get(q.id) ?? [],
      stress
    });
    if (value !== null) answers.push({ question: q.texto, value });
  }

  return {
    submitted_at: submitted.toISOString(),
    company,
    department,
    answers
  };
}

function elegirValor({ pregunta, opciones, stress }) {
  if (pregunta.scale_tipo === 'ABIERTA') {
    if (stress >= 0.66) return tomarUno(TEXTOS_NEGATIVOS);
    if (stress >= 0.33) return tomarUno(TEXTOS_NEUTROS);
    return tomarUno(TEXTOS_POSITIVOS);
  }
  if (pregunta.polaridad === 'NEUTRA') {
    // Demográfica: distribución uniforme.
    const utilizables = opciones.filter((o) => !o.es_no_aplica);
    return utilizables.length ? tomarUno(utilizables).etiqueta : null;
  }

  // Para preguntas con polaridad, valor_normalizado ya tiene la
  // polaridad aplicada: mayor número = más positivo.
  const ordenadas = opciones
    .filter((o) => !o.es_no_aplica && o.valor_normalizado !== null)
    .sort((a, b) => Number(b.valor_normalizado) - Number(a.valor_normalizado));

  if (!ordenadas.length) return null;

  // stress=0 → primer índice (más positivo); stress=1 → último (más negativo).
  let idx = Math.round(stress * (ordenadas.length - 1));
  if (Math.random() < CFG.noiseRate) {
    idx += Math.random() < 0.5 ? -1 : 1;
  }
  idx = Math.max(0, Math.min(ordenadas.length - 1, idx));
  return ordenadas[idx].etiqueta;
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

function fechaAleatoriaEnMes(monthsAgo) {
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  const ultimoDia = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  // Mes en curso: limitar a hoy para que no haya fechas futuras.
  const limite = monthsAgo === 0 ? Math.max(1, now.getUTCDate() - 1) : ultimoDia;
  const dia = 1 + Math.floor(Math.random() * limite);
  const hora = 7 + Math.floor(Math.random() * 12);
  const min = Math.floor(Math.random() * 60);
  const seg = Math.floor(Math.random() * 60);
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), dia, hora, min, seg));
}

function elegirAlAzar(arr, k) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, k);
}

function tomarUno(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function jitter(amp) {
  return (Math.random() * 2 - 1) * amp;
}

function clamp(v) {
  return Math.max(0, Math.min(1, v));
}

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else { out[key] = Number.isNaN(Number(next)) ? next : Number(next); i += 1; }
    }
  }
  return out;
}

main()
  .catch((err) => {
    logger.error({ err }, 'Demo seed falló');
    process.exitCode = 1;
  })
  .finally(closePool);
