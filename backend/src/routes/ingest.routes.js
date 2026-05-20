import { Router } from 'express';
import { ingestController } from '../controllers/ingest.controller.js';
import { requireIngestToken } from '../middleware/auth-ingest.js';
import { validate } from '../middleware/validate.js';
import { ingestBatchSchema, ingestSingleSchema } from '../validators/ingest.schemas.js';

const router = Router();

// n8n sólo puede llegar aquí. NO escribe en MySQL ni llama a Gemini.
// requireIngestToken se aplica por ruta (no con router.use) para no
// contaminar otras rutas cuando este sub-router se monta en '/'.
router.post(
  '/ingest',
  requireIngestToken,
  validate({ body: ingestSingleSchema }),
  ingestController.ingestOne
);

router.post(
  '/ingest/batch',
  requireIngestToken,
  validate({ body: ingestBatchSchema }),
  ingestController.ingestMany
);

export default router;
