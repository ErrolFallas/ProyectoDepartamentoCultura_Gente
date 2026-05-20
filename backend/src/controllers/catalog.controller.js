import { asyncHandler } from '../middleware/async-handler.js';
import * as catalogService from '../services/catalog.service.js';

export const catalogController = {
  pendientes: asyncHandler(async (_req, res) => {
    const rows = await catalogService.listarPendientesRevision();
    res.json({ items: rows });
  }),

  dimensiones: asyncHandler(async (_req, res) => {
    const rows = await catalogService.listarDimensiones();
    res.json({ items: rows });
  }),

  escalas: asyncHandler(async (_req, res) => {
    const rows = await catalogService.listarEscalas();
    res.json({ items: rows });
  })
};
