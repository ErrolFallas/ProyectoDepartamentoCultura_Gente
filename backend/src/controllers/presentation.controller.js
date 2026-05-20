import { asyncHandler } from '../middleware/async-handler.js';
import { recolectarDatosInforme } from '../services/presentation-data.service.js';
import { construirPresentacion } from '../services/presentation-builder.service.js';

export const presentationController = {
  /**
   * Genera el .pptx en memoria y lo envía como descarga. Devuelve también
   * algunos metadatos en headers para el frontend.
   */
  generate: asyncHandler(async (req, res) => {
    const { scope, scope_id, periodo } = req.body;
    const datos = await recolectarDatosInforme({
      scope,
      scopeId: Number(scope_id),
      periodo
    });

    const pptx = construirPresentacion(datos);
    const buffer = await pptx.write({ outputType: 'nodebuffer' });

    const safeNombre = sanitizar(datos.meta.nombre);
    const filename = `clima_${safeNombre}_${periodo}.pptx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Respuestas-Incluidas', String(datos.agregado.n_respuestas));
    res.setHeader('X-Nivel-Semaforo', datos.nivelSemaforo.nivel);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition,X-Respuestas-Incluidas,X-Nivel-Semaforo');
    res.send(buffer);
  }),

  /**
   * Devuelve un JSON con la "vista previa" de lo que incluirá el .pptx
   * sin generarlo. Útil para que el frontend muestre al usuario qué
   * habrá en el informe antes de descargarlo.
   */
  preview: asyncHandler(async (req, res) => {
    const datos = await recolectarDatosInforme({
      scope: req.query.scope,
      scopeId: Number(req.query.scope_id),
      periodo: req.query.periodo
    });
    res.json({
      meta: datos.meta,
      periodo: datos.periodo,
      scope: datos.scope,
      agregado: datos.agregado,
      posicionRanking: datos.posicionRanking,
      nivelSemaforo: datos.nivelSemaforo,
      cantidadDimensiones: datos.dimensiones.length,
      cantidadPreguntas: datos.dimensiones.reduce((s, d) => s + d.preguntas.length, 0),
      cantidadMejores: datos.mejores.length,
      cantidadPeores: datos.peores.length,
      cantidadTemas: datos.temas.top_temas.length,
      respuestasAbiertasAnalizadas: datos.temas.total_respuestas_abiertas
    });
  })
};

function sanitizar(nombre) {
  return (nombre ?? 'informe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .toLowerCase()
    .slice(0, 60);
}
