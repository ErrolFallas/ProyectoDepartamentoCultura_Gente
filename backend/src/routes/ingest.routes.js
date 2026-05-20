import { Router } from 'express';
import { ingestController } from '../controllers/ingest.controller.js';
import { requireIngestToken } from '../middleware/auth-ingest.js';
import { validate } from '../middleware/validate.js';
import { ingestBatchSchema, ingestSingleSchema } from '../validators/ingest.schemas.js';

const router = Router();

// n8n sólo puede llegar aquí. NO escribe en MySQL ni llama a Gemini.
router.use(requireIngestToken);

router.post('/responses/ingest', validate({ body: ingestSingleSchema }), ingestController.ingestOne);
router.post('/responses/ingest/batch', validate({ body: ingestBatchSchema }), ingestController.ingestMany);

export default router;
