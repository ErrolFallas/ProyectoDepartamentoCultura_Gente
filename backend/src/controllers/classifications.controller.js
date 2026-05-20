import { asyncHandler } from '../middleware/async-handler.js';
import * as classificationsService from '../services/classifications.service.js';

export const classificationsController = {
  list: asyncHandler(async (_req, res) => {
    const items = await classificationsService.listarPendientes();
    res.json({ items });
  }),

  confirm: asyncHandler(async (req, res) => {
    const result = await classificationsService.confirmarPolaridad({
      classificationId: Number(req.params.id),
      polaridadFinal: req.body.polaridad_final,
      accion: req.body.accion,
      usuarioId: req.user?.sub
    });
    res.json(result);
  })
};
