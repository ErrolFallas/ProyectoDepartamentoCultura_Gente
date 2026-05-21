/**
 * Catálogo de herramientas que la IA puede invocar para responder
 * preguntas del usuario. Cada entrada define:
 *   - declaration: el esquema (formato Gemini function calling) que se
 *     envía al modelo para que decida si llamarla.
 *   - execute: implementación real que consulta MySQL o servicios.
 *
 * Toda herramienta respeta el anonimato (MIN_RESPUESTAS_DEPARTAMENTO)
 * porque se apoya en los servicios existentes. La IA jamás recibe
 * respuestas individuales ni nombres de personas.
 */

import { pool } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { companiesRepo } from '../../repositories/companies.repo.js';
import { departmentsRepo } from '../../repositories/departments.repo.js';
import {
  aggregateForScope,
  aggregateForQuestion,
  distribucionOpciones
} from '../aggregates.service.js';
import { getRanking } from '../rankings.service.js';
import { listAlerts, focosActuales } from '../alerts.service.js';
import { snapshotsRepo } from '../../repositories/snapshots.repo.js';
import { distribucionPorDiaSemana, cronicidad } from '../temporal.service.js';

const PERIOD_HINT =
  'Período en formato YYYY-MM (mes específico) o YYYY (año entero). ' +
  'IMPORTANTE: si el usuario dice "este mes", "hoy", "ahora" o no menciona un período, ' +
  'OMITA este parámetro para que el sistema use el mes actual real. ' +
  'NUNCA pase un año o mes basado en su conocimiento de entrenamiento.';

const PERIOD_HINT_MES =
  'Período YYYY-MM. IMPORTANTE: omitir si el usuario dice "este mes/hoy/ahora" — ' +
  'el sistema usa el mes actual real. Nunca inventar año.';

export const TOOLS = [
  // -----------------------------------------------------------------
  // Catálogo organizacional
  // -----------------------------------------------------------------
  {
    declaration: {
      name: 'listarEmpresas',
      description:
        'Lista todas las empresas activas con su ID y nombre. ' +
        'Útil para responder qué empresas existen o para obtener el ID ' +
        'de una empresa antes de consultar sus estadísticas.',
      parameters: { type: 'OBJECT', properties: {} }
    },
    execute: async () => {
      const items = await companiesRepo.findAll();
      return { empresas: items.map((e) => ({ id: e.id, nombre: e.nombre })) };
    }
  },

  {
    declaration: {
      name: 'listarDepartamentos',
      description:
        'Lista los departamentos de una empresa específica. ' +
        'Útil para saber qué equipos forman parte de una empresa.',
      parameters: {
        type: 'OBJECT',
        properties: {
          company_id: { type: 'INTEGER', description: 'ID de la empresa' }
        },
        required: ['company_id']
      }
    },
    execute: async ({ company_id }) => {
      const items = await departmentsRepo.findByCompany(Number(company_id));
      return { departamentos: items.map((d) => ({ id: d.id, nombre: d.nombre })) };
    }
  },

  // -----------------------------------------------------------------
  // Semáforo y alertas
  // -----------------------------------------------------------------
  {
    declaration: {
      name: 'obtenerFocosDelPeriodo',
      description:
        'Devuelve los departamentos con termómetro NEGRO, ROJO o AMARILLO en el ' +
        'período indicado. Útil para "¿qué departamentos requieren atención?", ' +
        '"focos críticos del mes", "alertas activas".',
      parameters: {
        type: 'OBJECT',
        properties: {
          periodo: { type: 'STRING', description: PERIOD_HINT_MES }
        }
      }
    },
    execute: async ({ periodo } = {}) => {
      return focosActuales({ periodo });
    }
  },

  {
    declaration: {
      name: 'listarAlertas',
      description:
        'Lista alertas del termómetro de clima con filtros opcionales. Cada fila tiene ' +
        'departamento, empresa, nivel (VERDE/AMARILLO/ROJO/NEGRO), porcentaje negativo ' +
        'y si fue atendida.',
      parameters: {
        type: 'OBJECT',
        properties: {
          periodo: { type: 'STRING', description: PERIOD_HINT_MES },
          nivel: { type: 'STRING', description: 'VERDE, AMARILLO, ROJO o NEGRO. Omitir para todos.' },
          atendida: { type: 'BOOLEAN', description: 'true=ya atendida, false=pendiente. Omitir para todas.' }
        }
      }
    },
    execute: async (args = {}) => {
      const periodo = args.periodo ?? mesActualUTC();
      const items = await listAlerts({
        periodo,
        nivel: args.nivel ?? null,
        atendida: typeof args.atendida === 'boolean' ? args.atendida : null
      });
      return { periodo, total: items.length, alertas: items };
    }
  },

  {
    declaration: {
      name: 'empresasConMasAlertas',
      description:
        'Cuenta cuántas alertas tiene cada empresa en el período, agrupado por ' +
        'nivel. Útil para preguntas tipo "¿qué empresa tiene más focos críticos?", ' +
        '"qué empresa requiere más atención", "cuál es la empresa con más focos".',
      parameters: {
        type: 'OBJECT',
        properties: {
          periodo: { type: 'STRING', description: PERIOD_HINT_MES },
          nivel: {
            type: 'STRING',
            description: 'Filtrar por nivel (NEGRO, ROJO, AMARILLO). Omitir para contar todas.'
          },
          top_n: { type: 'INTEGER', description: 'Cuántas empresas devolver. Por defecto 10.' }
        }
      }
    },
    execute: async (args = {}) => {
      const periodo = args.periodo ?? mesActualUTC();
      const top = args.top_n ?? 10;
      const where = ['a.periodo = ?'];
      const params = [periodo];
      if (args.nivel) {
        where.push('a.nivel = ?');
        params.push(args.nivel);
      }
      const [rows] = await pool.query(
        `SELECT c.id AS company_id, c.nombre AS empresa,
                SUM(a.nivel = 'NEGRO')    AS negros,
                SUM(a.nivel = 'ROJO')     AS rojos,
                SUM(a.nivel = 'AMARILLO') AS amarillos,
                SUM(a.nivel = 'VERDE')    AS verdes,
                COUNT(*)                  AS total_alertas
           FROM alerts a
           JOIN departments d ON d.id = a.department_id
           JOIN companies   c ON c.id = d.company_id
          WHERE ${where.join(' AND ')}
          GROUP BY c.id, c.nombre
          ORDER BY negros DESC, rojos DESC, amarillos DESC
          LIMIT ?`,
        [...params, top]
      );
      return {
        periodo,
        filtroNivel: args.nivel ?? null,
        ranking: rows.map((r, i) => ({
          posicion: i + 1,
          empresa: r.empresa,
          company_id: r.company_id,
          negros: Number(r.negros),
          rojos: Number(r.rojos),
          amarillos: Number(r.amarillos),
          verdes: Number(r.verdes),
          total_alertas: Number(r.total_alertas)
        }))
      };
    }
  },

  // -----------------------------------------------------------------
  // Agregados (% positivo / neutro / negativo)
  // -----------------------------------------------------------------
  {
    declaration: {
      name: 'obtenerEstadisticasEntidad',
      description:
        'Devuelve %positivo, %negativo, %neutro, promedio normalizado y ' +
        'número de respuestas de una empresa o departamento en un período. ' +
        'Si el departamento tiene menos respuestas que el umbral mínimo, ' +
        'se devuelve anonimato_protegido=true y los porcentajes en null.',
      parameters: {
        type: 'OBJECT',
        properties: {
          scope: { type: 'STRING', description: '"COMPANY" para empresa, "DEPARTMENT" para departamento.' },
          scope_id: { type: 'INTEGER', description: 'ID de la empresa o departamento.' },
          periodo: { type: 'STRING', description: PERIOD_HINT }
        },
        required: ['scope', 'scope_id']
      }
    },
    execute: async ({ scope, scope_id, periodo }) => {
      const p = periodo ?? mesActualUTC();
      return { periodo: p, scope, scope_id, ...(await aggregateForScope({ scope, scopeId: Number(scope_id), periodo: p })) };
    }
  },

  {
    declaration: {
      name: 'compararEntidades',
      description:
        'Compara los porcentajes positivo/negativo de hasta 3 empresas o ' +
        '3 departamentos en el mismo período.',
      parameters: {
        type: 'OBJECT',
        properties: {
          scope: { type: 'STRING', description: 'COMPANY o DEPARTMENT' },
          scope_ids: {
            type: 'ARRAY',
            items: { type: 'INTEGER' },
            description: 'IDs a comparar (máximo 3)'
          },
          periodo: { type: 'STRING', description: PERIOD_HINT }
        },
        required: ['scope', 'scope_ids']
      }
    },
    execute: async ({ scope, scope_ids, periodo }) => {
      const p = periodo ?? mesActualUTC();
      const ids = (scope_ids ?? []).slice(0, 3).map(Number);
      const out = [];
      for (const id of ids) {
        const agg = await aggregateForScope({ scope, scopeId: id, periodo: p });
        out.push({ scope, scope_id: id, ...agg });
      }
      return { periodo: p, scope, comparativa: out };
    }
  },

  // -----------------------------------------------------------------
  // Rankings
  // -----------------------------------------------------------------
  {
    declaration: {
      name: 'obtenerRanking',
      description:
        'Top-20 de empresas o departamentos según un criterio. Útil para ' +
        '"¿cuál empresa tiene mejor clima?", "ranking de empresas por % positivo", ' +
        '"top departamentos en orgullo".',
      parameters: {
        type: 'OBJECT',
        properties: {
          tipo: {
            type: 'STRING',
            description: 'GLOBAL (% positivo general), POR_PREGUNTA, POR_DIMENSION.'
          },
          scope: { type: 'STRING', description: 'COMPANY o DEPARTMENT' },
          periodo: { type: 'STRING', description: PERIOD_HINT },
          question_id: { type: 'INTEGER', description: 'Solo si tipo=POR_PREGUNTA' },
          dimension_id: { type: 'INTEGER', description: 'Solo si tipo=POR_DIMENSION' }
        },
        required: ['tipo', 'scope']
      }
    },
    execute: async ({ tipo, scope, periodo, question_id, dimension_id }) => {
      const p = periodo ?? mesActualUTC();
      return getRanking({
        tipo,
        scope,
        periodo: p,
        questionId: question_id ?? null,
        dimensionId: dimension_id ?? null
      });
    }
  },

  // -----------------------------------------------------------------
  // Histórico y temporal
  // -----------------------------------------------------------------
  {
    declaration: {
      name: 'obtenerHistoricoMensual',
      description:
        'Evolución mensual (snapshots inmutables) de una empresa o ' +
        'departamento. Devuelve un arreglo de meses con % positivo y negativo.',
      parameters: {
        type: 'OBJECT',
        properties: {
          scope: { type: 'STRING', description: 'COMPANY o DEPARTMENT' },
          scope_id: { type: 'INTEGER' },
          lookback_months: { type: 'INTEGER', description: 'Cuántos meses hacia atrás. Por defecto 12.' }
        },
        required: ['scope', 'scope_id']
      }
    },
    execute: async ({ scope, scope_id, lookback_months }) => {
      const items = await snapshotsRepo.listHistory({
        scope,
        scope_id: Number(scope_id),
        question_id: null,
        lookbackMonths: Number(lookback_months ?? 12)
      });
      return { scope, scope_id, items };
    }
  },

  {
    declaration: {
      name: 'obtenerDistribucionPorDiaSemana',
      description:
        'Distribución de % negativo por día de la semana. Útil para ' +
        '"¿en qué día se concentran las emociones negativas?", "¿hay efecto lunes?".',
      parameters: {
        type: 'OBJECT',
        properties: {
          scope: { type: 'STRING', description: 'COMPANY o DEPARTMENT' },
          scope_id: { type: 'INTEGER' },
          periodo: { type: 'STRING', description: PERIOD_HINT }
        },
        required: ['scope', 'scope_id']
      }
    },
    execute: async ({ scope, scope_id, periodo }) => {
      const p = periodo ?? mesActualUTC();
      return distribucionPorDiaSemana({ scope, scopeId: Number(scope_id), periodo: p });
    }
  },

  {
    declaration: {
      name: 'obtenerCronicidad',
      description:
        'Determina si una entidad lleva varios meses consecutivos en ' +
        'alerta (NEGRO, ROJO o AMARILLO). Devuelve cuántos meses lleva y si es ' +
        'considerada crónica (≥ 3 meses).',
      parameters: {
        type: 'OBJECT',
        properties: {
          scope: { type: 'STRING', description: 'COMPANY o DEPARTMENT' },
          scope_id: { type: 'INTEGER' },
          lookback_months: { type: 'INTEGER', description: 'Por defecto 12.' }
        },
        required: ['scope', 'scope_id']
      }
    },
    execute: async ({ scope, scope_id, lookback_months }) => {
      return cronicidad({
        scope,
        scopeId: Number(scope_id),
        lookbackMonths: Number(lookback_months ?? 12)
      });
    }
  },

  // -----------------------------------------------------------------
  // Pregunta específica
  // -----------------------------------------------------------------
  {
    declaration: {
      name: 'obtenerEstadisticasDePregunta',
      description:
        'Estadísticas de una pregunta específica en un scope/período. ' +
        'Útil para "qué tan de acuerdo está el personal con X" cuando se ' +
        'conoce el question_id.',
      parameters: {
        type: 'OBJECT',
        properties: {
          scope: { type: 'STRING' },
          scope_id: { type: 'INTEGER' },
          question_id: { type: 'INTEGER' },
          periodo: { type: 'STRING', description: PERIOD_HINT }
        },
        required: ['scope', 'scope_id', 'question_id']
      }
    },
    execute: async ({ scope, scope_id, question_id, periodo }) => {
      const p = periodo ?? mesActualUTC();
      return aggregateForQuestion({
        scope,
        scopeId: Number(scope_id),
        questionId: Number(question_id),
        periodo: p
      });
    }
  },

  // -----------------------------------------------------------------
  // Análisis crónico (lista global)
  // -----------------------------------------------------------------
  {
    declaration: {
      name: 'listarDepartamentosCronicos',
      description:
        'Recorre todos los departamentos con alertas recientes y devuelve ' +
        'aquellos que llevan 3 o más meses consecutivos en AMARILLO, ROJO o NEGRO. ' +
        'Ideal para preguntas tipo "¿hay departamentos crónicos?", "¿quién ' +
        'lleva varios meses con alerta?".',
      parameters: {
        type: 'OBJECT',
        properties: {
          lookback_months: { type: 'INTEGER', description: 'Meses hacia atrás. Por defecto 12.' }
        }
      }
    },
    execute: async ({ lookback_months } = {}) => {
      const lookback = Number(lookback_months ?? 12);
      // Departamentos con al menos una alerta en algún período reciente.
      const [rows] = await pool.query(
        `SELECT DISTINCT a.department_id, d.nombre AS departamento,
                c.id AS company_id, c.nombre AS empresa
           FROM alerts a
           JOIN departments d ON d.id = a.department_id
           JOIN companies   c ON c.id = d.company_id
          WHERE a.nivel IN ('NEGRO','ROJO','AMARILLO')`
      );
      const cronicos = [];
      for (const r of rows) {
        const c = await cronicidad({
          scope: 'DEPARTMENT',
          scopeId: Number(r.department_id),
          lookbackMonths: lookback
        });
        if (c.cronica) {
          cronicos.push({
            departamento: r.departamento,
            empresa: r.empresa,
            meses_consecutivos: c.meses,
            nivel_actual: c.nivelActual
          });
        }
      }
      cronicos.sort((a, b) => b.meses_consecutivos - a.meses_consecutivos);
      return { total_cronicos: cronicos.length, lookback_meses: lookback, departamentos: cronicos };
    }
  },

  {
    declaration: {
      name: 'buscarEntidadPorNombre',
      description:
        'Búsqueda flexible por nombre de empresa o departamento (ej. "AVON", ' +
        '"avón", "Avon", "GGDI", "Operaciones"). Ignora mayúsculas, tildes ' +
        'y espacios extra. SIEMPRE llamar esta tool cuando el usuario ' +
        'mencione un nombre de empresa o departamento, ANTES de afirmar ' +
        'que no existe.',
      parameters: {
        type: 'OBJECT',
        properties: {
          texto: { type: 'STRING', description: 'Texto a buscar (parcial, tolerante a tildes y mayúsculas)' }
        },
        required: ['texto']
      }
    },
    execute: async ({ texto }) => {
      const query = normalizarTexto(String(texto ?? '').trim());
      if (!query) {
        return { empresas: [], departamentos: [], busqueda: '' };
      }

      // Cargamos todas las activas y filtramos en Node con normalización fuerte
      // (sin tildes, lower, sin espacios extra). Es robusto ante "Avón"/"avon"/
      // "AVON" y typos menores. Para BDs pequeñas (cientos de departamentos)
      // sigue siendo barato.
      const [empAll] = await pool.query(
        'SELECT id, nombre FROM companies WHERE activo = 1'
      );
      const [depAll] = await pool.query(
        `SELECT d.id, d.nombre, c.id AS company_id, c.nombre AS empresa
           FROM departments d JOIN companies c ON c.id = d.company_id
          WHERE d.activo = 1 AND c.activo = 1`
      );

      const empMatches = empAll
        .filter((e) => normalizarTexto(e.nombre).includes(query))
        .slice(0, 10)
        .map((e) => ({ id: e.id, nombre: e.nombre }));

      const depMatches = depAll
        .filter((d) => normalizarTexto(d.nombre).includes(query))
        .slice(0, 20)
        .map((d) => ({
          id: d.id, nombre: d.nombre,
          empresa: d.empresa, company_id: d.company_id
        }));

      return {
        empresas: empMatches,
        departamentos: depMatches,
        busqueda: query
      };
    }
  },

  // -----------------------------------------------------------------
  // Contexto / metadata
  // -----------------------------------------------------------------
  {
    declaration: {
      name: 'obtenerContextoActual',
      description:
        'Devuelve información del sistema (período actual, umbrales del ' +
        'semáforo, mínimo de respuestas por departamento, conteos totales). ' +
        'Útil para responder "¿cuál es el umbral de rojo?", "¿qué se considera ' +
        'crítico?", "¿cuántos departamentos hay?".',
      parameters: { type: 'OBJECT', properties: {} }
    },
    execute: async () => {
      const [[c]] = await pool.query('SELECT COUNT(*) AS n FROM companies WHERE activo = 1');
      const [[d]] = await pool.query('SELECT COUNT(*) AS n FROM departments WHERE activo = 1');
      const [[r]] = await pool.query('SELECT COUNT(*) AS n FROM responses');
      return {
        periodo_actual: mesActualUTC(),
        umbrales: {
          semaforo_amarillo_min: env.SEMAFORO_AMARILLO_MIN,
          semaforo_rojo_min: env.SEMAFORO_ROJO_MIN,
          semaforo_negro_min: env.SEMAFORO_NEGRO_MIN,
          minimo_respuestas_departamento: env.MIN_RESPUESTAS_DEPARTAMENTO,
          umbral_negativo_max: env.UMBRAL_NEGATIVO_MAX,
          umbral_neutro_max: env.UMBRAL_NEUTRO_MAX
        },
        conteos: {
          empresas: Number(c.n),
          departamentos: Number(d.n),
          respuestas_acumuladas: Number(r.n)
        }
      };
    }
  }
];

export function listarDeclaraciones() {
  return TOOLS.map((t) => t.declaration);
}

export function obtenerEjecutor(nombre) {
  const t = TOOLS.find((x) => x.declaration.name === nombre);
  return t ? t.execute : null;
}

function normalizarTexto(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function mesActualUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
