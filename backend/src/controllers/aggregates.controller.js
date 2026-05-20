import { asyncHandler } from '../middleware/async-handler.js';
import {
  aggregateForScope,
  aggregateForQuestion,
  distribucionOpciones
} from '../services/aggregates.service.js';

export const aggregatesController = {
  scope: asyncHandler(async (req, res) => {
    const result = await aggregateForScope({
      scope: req.query.scope,
      scopeId: req.query.scope_id,
      periodo: req.query.periodo
    });
    res.json(result);
  }),

  question: asyncHandler(async (req, res) => {
    const result = await aggregateForQuestion({
      scope: req.query.scope,
      scopeId: req.query.scope_id,
      questionId: req.query.question_id,
      periodo: req.query.periodo
    });
    res.json(result);
  }),

  questionDistribution: asyncHandler(async (req, res) => {
    const items = await distribucionOpciones({
      scope: req.query.scope,
      scopeId: req.query.scope_id,
      questionId: req.query.question_id,
      periodo: req.query.periodo
    });
    res.json({ items });
  }),

  compare: asyncHandler(async (req, res) => {
    const { scope, scope_ids, periodo } = req.query;
    const out = [];
    for (const id of scope_ids) {
      const agg = await aggregateForScope({ scope, scopeId: id, periodo });
      out.push({ scope, scope_id: id, periodo, ...agg });
    }
    res.json({ items: out });
  })
};
