import { Router } from 'express';
import { rankingsController } from '../controllers/rankings.controller.js';
import { requireAuth } from '../middleware/auth-jwt.js';
import { validate } from '../middleware/validate.js';
import { rankingQuery } from '../validators/analytics.schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: rankingQuery }), rankingsController.get);
router.post('/recompute', validate({ query: rankingQuery }), rankingsController.recompute);

export default router;
