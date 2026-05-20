import { asyncHandler } from '../middleware/async-handler.js';
import * as rankingsService from '../services/rankings.service.js';

export const rankingsController = {
  get: asyncHandler(async (req, res) => {
    const result = await rankingsService.getRanking({
      tipo: req.query.tipo,
      scope: req.query.scope,
      periodo: req.query.periodo,
      questionId: req.query.question_id ?? null,
      dimensionId: req.query.dimension_id ?? null
    });
    res.json(result);
  }),

  recompute: asyncHandler(async (req, res) => {
    const items = await rankingsService.recalcular({
      tipo: req.query.tipo,
      scope: req.query.scope,
      periodo: req.query.periodo,
      questionId: req.query.question_id ?? null,
      dimensionId: req.query.dimension_id ?? null
    });
    res.status(201).json({ items, recalculado: true });
  })
};
