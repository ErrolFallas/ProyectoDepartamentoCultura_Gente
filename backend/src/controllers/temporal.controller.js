import { asyncHandler } from '../middleware/async-handler.js';
import * as temporalService from '../services/temporal.service.js';

export const temporalController = {
  diaSemana: asyncHandler(async (req, res) => {
    const result = await temporalService.distribucionPorDiaSemana({
      scope: req.query.scope,
      scopeId: req.query.scope_id,
      periodo: req.query.periodo
    });
    res.json(result);
  }),

  cronicidad: asyncHandler(async (req, res) => {
    const result = await temporalService.cronicidad({
      scope: req.query.scope,
      scopeId: req.query.scope_id,
      lookbackMonths: req.query.lookback_months
    });
    res.json(result);
  })
};
