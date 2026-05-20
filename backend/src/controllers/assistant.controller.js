import { asyncHandler } from '../middleware/async-handler.js';
import { preguntarAsistente } from '../services/assistant/assistant.service.js';
import { listarDeclaraciones } from '../services/assistant/tools-catalog.js';
import { env } from '../config/env.js';

export const assistantController = {
  ask: asyncHandler(async (req, res) => {
    const { messages } = req.body;
    const result = await preguntarAsistente({ messages });
    res.json(result);
  }),

  capabilities: asyncHandler(async (_req, res) => {
    const declaraciones = listarDeclaraciones();
    res.json({
      configurado: Boolean(env.GEMINI_API_KEY),
      modelo: env.GEMINI_MODEL,
      cantidadHerramientas: declaraciones.length,
      herramientas: declaraciones.map((d) => ({
        nombre: d.name,
        descripcion: d.description
      }))
    });
  })
};
