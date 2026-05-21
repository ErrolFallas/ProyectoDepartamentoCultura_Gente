/**
 * Router determinístico de intenciones.
 *
 * Antes de invocar al modelo de IA, este módulo intenta detectar si la pregunta
 * del usuario corresponde a uno de los patrones más comunes. Si hay un match
 * INEQUÍVOCO (modo conservador), ejecuta la tool directamente y arma una
 * respuesta con plantilla. Esto:
 *
 *   - Ahorra cuota de Gemini/Groq (las preguntas frecuentes no consumen IA).
 *   - Devuelve respuesta en milisegundos en lugar de varios segundos.
 *   - Es 100% determinístico (auditable, sin alucinación posible).
 *
 * Si NO hay match claro, devuelve null y el flujo cae al modelo de IA.
 */

import { obtenerEjecutor } from './tools-catalog.js';

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿¡!?.,;:()"'`´]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pct(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(1)}%`;
}

const NIVEL_ETIQUETA = {
  NEGRO: 'crisis (negro)',
  ROJO: 'alto (rojo)',
  AMARILLO: 'medio (amarillo)',
  VERDE: 'estable (verde)'
};

// ---------------------------------------------------------------------------
// Definición de intenciones. Cada una declara un patrón estricto y un
// ejecutor que ya armó respuesta lista.
// ---------------------------------------------------------------------------

const INTENCIONES = [
  // 1) Focos críticos del período
  {
    nombre: 'focos_criticos',
    patron: /\b(focos?\s+(criticos?|del\s+(mes|periodo))|que\s+(equipos?|departamentos?)\s+(requieren?|necesitan?)\s+atencion|alertas?\s+activas?|departamentos?\s+en\s+(rojo|alto|negro|crisis))\b/,
    ejecutar: async () => {
      const focos = await obtenerEjecutor('obtenerFocosDelPeriodo')({});
      const lineas = [];
      if (focos.negros?.length) lineas.push(`- En **crisis (negro)**: ${focos.negros.length} departamento(s).`);
      if (focos.rojos?.length) lineas.push(`- En **alto (rojo)**: ${focos.rojos.length} departamento(s).`);
      if (focos.amarillos?.length) lineas.push(`- En **medio (amarillo)**: ${focos.amarillos.length} departamento(s).`);
      const total = (focos.negros?.length ?? 0) + (focos.rojos?.length ?? 0) + (focos.amarillos?.length ?? 0);
      const intro = total === 0
        ? `No se identifican focos críticos en ${focos.periodo}. Los departamentos con datos suficientes están estables.`
        : `Para el período ${focos.periodo} se identifican **${total} foco(s)** que requieren atención:`;
      const detalle = [];
      for (const lvl of ['negros', 'rojos', 'amarillos']) {
        for (const d of (focos[lvl] ?? []).slice(0, 5)) {
          detalle.push(`  · ${d.departamento} (${d.empresa}) — ${pct(d.pct_negativo)} negativo`);
        }
      }
      return {
        respuesta: [intro, ...lineas, ...(detalle.length ? ['', 'Detalle:', ...detalle] : [])].join('\n'),
        toolCalls: [{ name: 'obtenerFocosDelPeriodo', args: {}, result: focos }]
      };
    }
  },

  // 2) Conteo de departamentos en niveles críticos
  {
    nombre: 'conteo_negros_rojos',
    patron: /\bcuantos?\s+departamentos?\s+(estan?|hay)\s+(en\s+)?(negro|rojo|crisis|alto|criticos?)\b/,
    ejecutar: async () => {
      const focos = await obtenerEjecutor('obtenerFocosDelPeriodo')({});
      const negros = focos.negros?.length ?? 0;
      const rojos = focos.rojos?.length ?? 0;
      const respuesta = `En ${focos.periodo} hay **${negros} departamento(s) en crisis (negro)** y **${rojos} en alto (rojo)**. ` +
        (negros + rojos === 0
          ? 'Ningún departamento está en nivel crítico este período.'
          : 'Se recomienda priorizar visita o intervención de Cultura y Gente.');
      return {
        respuesta,
        toolCalls: [{ name: 'obtenerFocosDelPeriodo', args: {}, result: focos }]
      };
    }
  },

  // 3) Empresa con más alertas críticas
  {
    nombre: 'empresa_mas_alertas',
    patron: /\b(que|cual)\s+empresa\s+tiene\s+mas\s+(alertas?|focos?)\s+(criticas?|negras?|rojas?)\b/,
    ejecutar: async () => {
      const res = await obtenerEjecutor('empresasConMasAlertas')({ top_n: 5 });
      if (!res.ranking?.length) {
        return {
          respuesta: `No hay alertas críticas registradas en el período ${res.periodo}.`,
          toolCalls: [{ name: 'empresasConMasAlertas', args: { top_n: 5 }, result: res }]
        };
      }
      const lider = res.ranking[0];
      const lineas = [
        `En ${res.periodo}, la empresa con más alertas críticas es **${lider.empresa}** con ${lider.negros} en negro y ${lider.rojos} en rojo.`,
        '',
        'Ranking (top 5):'
      ];
      res.ranking.forEach((e) => {
        lineas.push(`${e.posicion}. ${e.empresa} — ${e.negros} negros · ${e.rojos} rojos · ${e.amarillos} amarillos`);
      });
      return {
        respuesta: lineas.join('\n'),
        toolCalls: [{ name: 'empresasConMasAlertas', args: { top_n: 5 }, result: res }]
      };
    }
  },

  // 4) Departamentos crónicos
  {
    nombre: 'departamentos_cronicos',
    patron: /\b(departamentos?|equipos?)\s+cronicos?\b|\bcronicidad\b|\b(3|tres|varios)\s+meses?\s+en\s+alerta\b/,
    ejecutar: async () => {
      const res = await obtenerEjecutor('listarDepartamentosCronicos')({});
      if (!res.departamentos?.length) {
        return {
          respuesta: `No hay departamentos crónicos en los últimos ${res.lookback_meses} meses. Ningún equipo lleva 3 o más meses consecutivos en alerta.`,
          toolCalls: [{ name: 'listarDepartamentosCronicos', args: {}, result: res }]
        };
      }
      const lineas = [
        `Se identificaron **${res.total_cronicos} departamento(s) crónico(s)** (3+ meses consecutivos en alerta):`,
        ''
      ];
      res.departamentos.slice(0, 8).forEach((d) => {
        lineas.push(`- ${d.departamento} (${d.empresa}) — ${d.meses_consecutivos} meses · nivel actual: ${NIVEL_ETIQUETA[d.nivel_actual] ?? d.nivel_actual}`);
      });
      lineas.push('', 'Estos equipos merecen un acompañamiento sostenido por parte de Cultura y Gente.');
      return {
        respuesta: lineas.join('\n'),
        toolCalls: [{ name: 'listarDepartamentosCronicos', args: {}, result: res }]
      };
    }
  },

  // 5) Top N departamentos con mejor porcentaje positivo
  {
    nombre: 'top_departamentos_positivo',
    patron: /\btop\s*(\d+)?\s+departamentos?\s+con\s+(mejor(es)?|mayor)\s+(porcentaje\s+positivo|positividad|positivo|clima)\b/,
    ejecutar: async (preguntaNorm) => {
      const m = preguntaNorm.match(/\btop\s*(\d+)/);
      const n = m ? Math.min(20, Math.max(1, Number(m[1]))) : 10;
      const res = await obtenerEjecutor('obtenerRanking')({ tipo: 'GLOBAL', scope: 'DEPARTMENT' });
      const items = (res.items ?? []).slice(0, n);
      if (!items.length) {
        return {
          respuesta: 'No hay datos suficientes para armar el ranking de departamentos este período.',
          toolCalls: [{ name: 'obtenerRanking', args: { tipo: 'GLOBAL', scope: 'DEPARTMENT' }, result: res }]
        };
      }
      const lineas = [
        `Top ${items.length} departamentos con mejor porcentaje positivo:`,
        ''
      ];
      items.forEach((d) => {
        lineas.push(`${d.posicion}. ${d.departamento} (${d.empresa}) — ${pct(d.valor)} positivo`);
      });
      return {
        respuesta: lineas.join('\n'),
        toolCalls: [{ name: 'obtenerRanking', args: { tipo: 'GLOBAL', scope: 'DEPARTMENT' }, result: res }]
      };
    }
  },

  // 6) Ranking de empresas con peor clima (toma los últimos del ranking GLOBAL)
  {
    nombre: 'ranking_empresas_peor_clima',
    patron: /\branking\s+de?\s*(las?\s+)?(\d+)?\s*empresas?\s+con\s+(peor|peores)\s+clima\b/,
    ejecutar: async (preguntaNorm) => {
      const m = preguntaNorm.match(/\b(\d+)\s+empresas?/);
      const n = m ? Math.min(20, Math.max(1, Number(m[1]))) : 5;
      const res = await obtenerEjecutor('obtenerRanking')({ tipo: 'GLOBAL', scope: 'COMPANY' });
      const items = (res.items ?? []).slice().reverse().slice(0, n);
      if (!items.length) {
        return {
          respuesta: 'No hay datos suficientes para armar el ranking de empresas este período.',
          toolCalls: [{ name: 'obtenerRanking', args: { tipo: 'GLOBAL', scope: 'COMPANY' }, result: res }]
        };
      }
      const lineas = [
        `Empresas con peor clima en este período (${items.length} mostradas):`,
        ''
      ];
      items.forEach((e, i) => {
        lineas.push(`${i + 1}. ${e.empresa} — ${pct(e.valor)} positivo (posición ${e.posicion} de ${res.items.length})`);
      });
      lineas.push('', 'Estas empresas concentran los porcentajes positivos más bajos del período actual.');
      return {
        respuesta: lineas.join('\n'),
        toolCalls: [{ name: 'obtenerRanking', args: { tipo: 'GLOBAL', scope: 'COMPANY' }, result: res }]
      };
    }
  },

  // 7) Listar empresas
  {
    nombre: 'listar_empresas',
    patron: /\b((que|cuales)\s+empresas\s+(hay|existen|estan\s+activas)|listame?\s+(las\s+)?empresas|empresas\s+activas)\b/,
    ejecutar: async () => {
      const res = await obtenerEjecutor('listarEmpresas')({});
      if (!res.empresas?.length) {
        return {
          respuesta: 'Actualmente no hay empresas activas registradas en la plataforma.',
          toolCalls: [{ name: 'listarEmpresas', args: {}, result: res }]
        };
      }
      const lineas = [
        `Hay **${res.empresas.length} empresa(s)** activa(s) en la plataforma:`,
        '',
        ...res.empresas.map((e) => `- ${e.nombre}`)
      ];
      return {
        respuesta: lineas.join('\n'),
        toolCalls: [{ name: 'listarEmpresas', args: {}, result: res }]
      };
    }
  },

  // 8) Cuántas empresas / departamentos hay en total
  {
    nombre: 'conteo_total_entidades',
    patron: /\bcuantas?\s+(empresas?|departamentos?)\s+(hay|existen|estan\s+activas?)\b/,
    ejecutar: async (preguntaNorm) => {
      const ctx = await obtenerEjecutor('obtenerContextoActual')({});
      const pideEmpresas = /\bempresas?\b/.test(preguntaNorm);
      const pideDeptos = /\bdepartamentos?\b/.test(preguntaNorm);
      const partes = [];
      if (pideEmpresas) partes.push(`**${ctx.conteos.empresas} empresa(s)** activa(s)`);
      if (pideDeptos) partes.push(`**${ctx.conteos.departamentos} departamento(s)** activo(s)`);
      const respuesta = `En la plataforma hay ${partes.join(' y ')}. ` +
        `En total se han registrado ${ctx.conteos.respuestas_acumuladas.toLocaleString('es-CR')} respuestas anónimas de clima.`;
      return {
        respuesta,
        toolCalls: [{ name: 'obtenerContextoActual', args: {}, result: ctx }]
      };
    }
  },

  // 10) Departamentos críticos / en alerta de una empresa específica
  //     Captura múltiples formas: "departamentos críticos de AVON",
  //     "cuáles son los departamentos con estado crítico de la empresa AVON",
  //     "departamentos en rojo de GGDI", "alertas críticas de Lanco",
  //     "qué equipos están mal en Novar".
  //
  //     Estrategia: detectamos la combinación de DOS señales:
  //       (1) la pregunta menciona "departamentos/equipos/alertas/focos"
  //       (2) menciona un nivel crítico ("critico/crisis/negro/rojo/alto/mal/grave/atención")
  //     Si ambas señales están presentes, intentamos resolver el nombre de
  //     la empresa al final de la oración.
  {
    nombre: 'criticos_por_empresa',
    patron: /\b(departamentos?|equipos?|alertas?|focos?)\b.*\b(critic[oa]s?|crisis|negr[oa]s?|roj[oa]s?|alto|mal(o|os)?|grave[s]?|atenci[oó]n|emergencia|riesgo|atender)\b.*\b(de|en)\s+(la\s+empresa\s+)?\S+/,
    ejecutar: async (preguntaNorm, preguntaOriginal) => {
      // Extraemos el último "nombre propio" de la oración. Esta regex es
      // permisiva: aceptamos "AVON", "ggdi", "lanco s.a.", etc.
      // Asumimos que el nombre de la empresa es la última palabra significativa.
      const ultimaPalabra = preguntaNorm.split(/\s+/).filter(Boolean).pop();
      // Probamos primero la palabra completa final, después intentamos
      // 2 palabras finales en caso de razón social compuesta.
      const candidatos = [];
      const partes = preguntaNorm.split(/\s+/).filter(Boolean);
      if (partes.length >= 1) candidatos.push(partes[partes.length - 1]);
      if (partes.length >= 2) candidatos.push(partes.slice(-2).join(' '));
      if (partes.length >= 3) candidatos.push(partes.slice(-3).join(' '));

      const buscar = obtenerEjecutor('buscarEntidadPorNombre');
      let empresaEncontrada = null;
      let busquedaUsada = null;
      const intentos = [];

      for (const cand of candidatos) {
        const res = await buscar({ texto: cand });
        intentos.push({ buscado: cand, encontrados: res.empresas.length });
        if (res.empresas.length === 1) {
          empresaEncontrada = res.empresas[0];
          busquedaUsada = cand;
          break;
        }
        if (res.empresas.length > 1) {
          // Ambigüedad: pasamos a IA para que decida cuál de las opciones es.
          return null; // Falla el router → cae a IA con todo el contexto.
        }
      }

      if (!empresaEncontrada) {
        // No matcheó. Listamos las empresas disponibles para que la respuesta
        // sea útil aun en error.
        const listar = obtenerEjecutor('listarEmpresas');
        const todas = await listar({});
        const nombresEmpresas = todas.empresas.map((e) => e.nombre).join(', ');
        return {
          respuesta:
            `No encontré una empresa con ese nombre. Las empresas registradas en la plataforma son: **${nombresEmpresas}**. ` +
            `Si la pregunta era sobre una de ellas, indique el nombre exacto.`,
          toolCalls: [
            { name: 'buscarEntidadPorNombre', args: { texto: ultimaPalabra }, result: { intentos } },
            { name: 'listarEmpresas', args: {}, result: todas }
          ]
        };
      }

      // Tenemos la empresa. Ahora buscamos sus alertas en el período actual.
      const listAlerts = obtenerEjecutor('listarAlertas');
      // Tres consultas en serie: NEGRO, ROJO, AMARILLO — más explícitas que filtrar después.
      const [negros, rojos, amarillos] = await Promise.all([
        listAlerts({ nivel: 'NEGRO' }),
        listAlerts({ nivel: 'ROJO' }),
        listAlerts({ nivel: 'AMARILLO' })
      ]);

      const filtrarPorEmpresa = (arr) =>
        (arr.alertas ?? []).filter((a) => a.company_id === empresaEncontrada.id || a.empresa === empresaEncontrada.nombre);

      const negrosDeEmpresa = filtrarPorEmpresa(negros);
      const rojosDeEmpresa = filtrarPorEmpresa(rojos);
      const amarillosDeEmpresa = filtrarPorEmpresa(amarillos);

      const periodo = negros.periodo;
      const totalCriticos = negrosDeEmpresa.length + rojosDeEmpresa.length;

      const lineas = [];
      if (totalCriticos === 0 && amarillosDeEmpresa.length === 0) {
        lineas.push(
          `En el período ${periodo}, **${empresaEncontrada.nombre}** no tiene departamentos en estado crítico ni en atención. ` +
          `Los equipos con datos suficientes están dentro del rango estable.`
        );
      } else {
        lineas.push(
          `Estado crítico de **${empresaEncontrada.nombre}** en ${periodo}:`,
          ''
        );
        if (negrosDeEmpresa.length) {
          lineas.push(`**Crisis (negro)** — ${negrosDeEmpresa.length} departamento(s):`);
          negrosDeEmpresa.forEach((a) => lineas.push(`  · ${a.departamento} — ${Number(a.pct_negativo).toFixed(1)}% negativo`));
          lineas.push('');
        }
        if (rojosDeEmpresa.length) {
          lineas.push(`**Alto (rojo)** — ${rojosDeEmpresa.length} departamento(s):`);
          rojosDeEmpresa.forEach((a) => lineas.push(`  · ${a.departamento} — ${Number(a.pct_negativo).toFixed(1)}% negativo`));
          lineas.push('');
        }
        if (amarillosDeEmpresa.length) {
          lineas.push(`Adicionalmente, en nivel medio (amarillo): ${amarillosDeEmpresa.length} departamento(s).`);
        }
        if (totalCriticos > 0) {
          lineas.push('', 'Se recomienda priorizar acompañamiento a estos equipos.');
        }
      }

      return {
        respuesta: lineas.join('\n'),
        toolCalls: [
          { name: 'buscarEntidadPorNombre', args: { texto: busquedaUsada }, result: { empresa: empresaEncontrada } },
          { name: 'listarAlertas', args: { nivel: 'NEGRO' }, result: { total: negrosDeEmpresa.length, alertas: negrosDeEmpresa } },
          { name: 'listarAlertas', args: { nivel: 'ROJO' }, result: { total: rojosDeEmpresa.length, alertas: rojosDeEmpresa } }
        ]
      };
    }
  },

  // 9) Umbrales del termómetro
  {
    nombre: 'umbrales_termometro',
    patron: /\b(cual\s+es\s+el\s+umbral|que\s+es\s+(critico|crisis)|cuanto\s+es\s+(rojo|negro|amarillo)|umbrales?\s+del\s+(termometro|nivel))\b/,
    ejecutar: async () => {
      const ctx = await obtenerEjecutor('obtenerContextoActual')({});
      const u = ctx.umbrales;
      const respuesta = [
        'Los niveles del termómetro de clima se determinan por el porcentaje del personal en estado negativo:',
        '',
        `- **Estable (verde)**: menos del ${u.semaforo_amarillo_min}%`,
        `- **Medio (amarillo)**: entre ${u.semaforo_amarillo_min}% y ${u.semaforo_rojo_min - 1}%`,
        `- **Alto (rojo)**: entre ${u.semaforo_rojo_min}% y ${u.semaforo_negro_min - 1}%`,
        `- **Crisis (negro)**: ${u.semaforo_negro_min}% o más`,
        '',
        `Además, un departamento necesita al menos ${u.minimo_respuestas_departamento} respuestas en el período para que se publique su nivel (protección de anonimato).`
      ].join('\n');
      return {
        respuesta,
        toolCalls: [{ name: 'obtenerContextoActual', args: {}, result: ctx }]
      };
    }
  }
];

/**
 * Intenta resolver la pregunta vía router. Devuelve:
 *   - { respuesta, toolCalls, intent } si hubo match.
 *   - null si ninguna intención coincide.
 */
export async function intentarResolverPorRouter(pregunta) {
  const norm = normalizar(pregunta);
  for (const intencion of INTENCIONES) {
    if (intencion.patron.test(norm)) {
      const resultado = await intencion.ejecutar(norm, pregunta);
      // Una intención puede declinar (devolver null/undefined) si detecta
      // ambigüedad o datos insuficientes — en ese caso caemos a IA.
      if (resultado && resultado.respuesta) {
        return {
          respuesta: resultado.respuesta,
          toolCalls: resultado.toolCalls,
          intent: intencion.nombre
        };
      }
    }
  }
  return null;
}

export function listarIntencionesSoportadas() {
  return INTENCIONES.map((i) => i.nombre);
}
