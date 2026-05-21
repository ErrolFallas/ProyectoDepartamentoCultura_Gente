import { asyncHandler } from '../middleware/async-handler.js';
import { preguntarAsistente } from '../services/assistant/assistant.service.js';
import { listarDeclaraciones } from '../services/assistant/tools-catalog.js';
import { consumirCuota, obtenerEstadoCuota } from '../services/assistant/assistant-quota.service.js';
import { topPreguntas } from '../services/assistant/assistant-cache.service.js';
import { env } from '../config/env.js';

const PLANTILLAS_SUGERENCIAS = [
  {
    categoria: 'Estado actual',
    icono: '◉',
    descripcion: 'Identifique qué equipos requieren atención inmediata',
    plantillas: [
      { texto: '¿Hay focos críticos hoy?', editable: false },
      { texto: '¿Cuántos departamentos están en negro o rojo este mes?', editable: false },
      { texto: '¿Qué empresa tiene más alertas críticas en este período?', editable: false }
    ]
  },
  {
    categoria: 'Comparativas',
    icono: '⇆',
    descripcion: 'Compare empresas o departamentos · reemplace los datos en paréntesis',
    plantillas: [
      { texto: 'Compare (nombre empresa o departamento) y (nombre empresa o departamento) en este período', editable: true },
      { texto: '¿Cómo están los porcentajes de (nombre empresa) este mes?', editable: true },
      { texto: '¿Cómo está el departamento (nombre departamento) de (nombre empresa)?', editable: true }
    ]
  },
  {
    categoria: 'Tendencias e histórico',
    icono: '⤴',
    descripcion: 'Evolución mensual, cronicidad y patrones por día',
    plantillas: [
      { texto: '¿Hay algún departamento crónico (3 meses o más en alerta)?', editable: false },
      { texto: '¿En qué día de la semana se concentran las emociones negativas en (nombre empresa)?', editable: true },
      { texto: '¿Cómo evolucionó (nombre empresa o departamento) en los últimos 6 meses?', editable: true }
    ]
  },
  {
    categoria: 'Rankings',
    icono: '☷',
    descripcion: 'Ordene empresas o departamentos por indicadores',
    plantillas: [
      { texto: 'Ranking de las 5 empresas con peor clima este mes', editable: false },
      { texto: 'Top 10 departamentos con mejor porcentaje positivo', editable: false },
      { texto: '¿Cuál es la posición de (nombre empresa) en el ranking global?', editable: true }
    ]
  },
  {
    categoria: 'Bienestar y prácticas de RRHH',
    icono: '❤',
    descripcion: 'Consultas generales sobre clima, bienestar y manejo de equipos',
    plantillas: [
      { texto: '¿Qué señales indican que un equipo está en riesgo de burnout?', editable: false },
      { texto: '¿Cómo puedo acompañar a un departamento con clima negativo crónico?', editable: false },
      { texto: 'Me siento muy estresada en el trabajo, ¿qué prácticas me recomienda?', editable: false },
      { texto: '¿Qué dinámicas funcionan para mejorar el clima de un equipo?', editable: false }
    ]
  }
];

export const assistantController = {
  ask: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    const { messages } = req.body;
    const result = await preguntarAsistente({ messages });
    // Las respuestas servidas desde caché NO descuentan cuota.
    const cuota = result.desdeCache
      ? await obtenerEstadoCuota(userId)
      : await consumirCuota(userId);
    res.json({ ...result, cuota });
  }),

  capabilities: asyncHandler(async (_req, res) => {
    const declaraciones = listarDeclaraciones();
    res.json({
      configurado: Boolean(env.GEMINI_API_KEY) || Boolean(env.GROQ_API_KEY),
      modelo: env.GEMINI_MODEL,
      respaldoConfigurado: Boolean(env.GROQ_API_KEY),
      modeloRespaldo: env.GROQ_API_KEY ? env.GROQ_MODEL : null,
      cantidadHerramientas: declaraciones.length,
      herramientas: declaraciones.map((d) => ({
        nombre: d.name,
        descripcion: d.description
      }))
    });
  }),

  quota: asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    const estado = await obtenerEstadoCuota(userId);
    res.json(estado);
  }),

  suggestions: asyncHandler(async (_req, res) => {
    const frecuentes = await topPreguntas(5);
    res.json({
      plantillas: PLANTILLAS_SUGERENCIAS,
      frecuentes,
      cacheTTLMin: env.ASSISTANT_CACHE_TTL_MIN
    });
  })
};
