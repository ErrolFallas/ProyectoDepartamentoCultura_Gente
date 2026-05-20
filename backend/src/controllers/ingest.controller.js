import { asyncHandler } from '../middleware/async-handler.js';
import { ingestRow, ingestBatch } from '../services/ingest.service.js';

export const ingestController = {
  ingestOne: asyncHandler(async (req, res) => {
    const result = await ingestRow(req.body);
    res.status(result.status === 'DUPLICADO' ? 200 : 201).json(result);
  }),

  ingestMany: asyncHandler(async (req, res) => {
    const { survey_run_id, rows } = req.body;
    const summary = await ingestBatch(rows, { surveyRunId: survey_run_id });
    res.status(207).json(summary);
  })
};
