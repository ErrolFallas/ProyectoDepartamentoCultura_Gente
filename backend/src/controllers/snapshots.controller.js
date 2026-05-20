import { asyncHandler } from '../middleware/async-handler.js';
import * as snapshotsService from '../services/snapshots.service.js';

export const snapshotsController = {
  close: asyncHandler(async (req, res) => {
    const result = await snapshotsService.closeMonth(req.body.periodo);
    res.status(201).json(result);
  }),

  list: asyncHandler(async (req, res) => {
    const items = await snapshotsService.listSnapshots({
      periodo: req.query.periodo,
      scope: req.query.scope
    });
    res.json({ items });
  }),

  history: asyncHandler(async (req, res) => {
    const history = await snapshotsService.getHistory({
      scope: req.query.scope,
      scopeId: req.query.scope_id,
      questionId: req.query.question_id ?? null,
      lookbackMonths: req.query.lookback_months
    });
    res.json({ items: history });
  })
};
