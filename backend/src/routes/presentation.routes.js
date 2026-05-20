import { Router } from 'express';
import { presentationController } from '../controllers/presentation.controller.js';
import { requireAuth } from '../middleware/auth-jwt.js';
import { validate } from '../middleware/validate.js';
import { generateSchema, previewQuerySchema } from '../validators/presentation.schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/preview', validate({ query: previewQuerySchema }), presentationController.preview);
router.post('/generate', validate({ body: generateSchema }), presentationController.generate);

export default router;
