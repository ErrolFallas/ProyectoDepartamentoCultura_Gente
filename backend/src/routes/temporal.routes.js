import { Router } from 'express';
import { temporalController } from '../controllers/temporal.controller.js';
import { requireAuth } from '../middleware/auth-jwt.js';
import { validate } from '../middleware/validate.js';
import { temporalQuery, cronicidadQuery } from '../validators/analytics.schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/day-of-week', validate({ query: temporalQuery }), temporalController.diaSemana);
router.get('/cronicidad', validate({ query: cronicidadQuery }), temporalController.cronicidad);

export default router;
