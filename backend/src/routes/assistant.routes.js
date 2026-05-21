import { Router } from 'express';
import { assistantController } from '../controllers/assistant.controller.js';
import { requireAuth } from '../middleware/auth-jwt.js';
import { validate } from '../middleware/validate.js';
import { askSchema } from '../validators/assistant.schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/capabilities', assistantController.capabilities);
router.get('/quota', assistantController.quota);
router.get('/suggestions', assistantController.suggestions);
router.post('/ask', validate({ body: askSchema }), assistantController.ask);

export default router;
