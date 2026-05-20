import { Router } from 'express';
import { aggregatesController } from '../controllers/aggregates.controller.js';
import { requireAuth } from '../middleware/auth-jwt.js';
import { validate } from '../middleware/validate.js';
import {
  aggregateScopeQuery,
  aggregateQuestionQuery,
  compareSelector
} from '../validators/analytics.schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/scope', validate({ query: aggregateScopeQuery }), aggregatesController.scope);
router.get('/question', validate({ query: aggregateQuestionQuery }), aggregatesController.question);
router.get('/question/distribution', validate({ query: aggregateQuestionQuery }), aggregatesController.questionDistribution);
router.get('/compare', validate({ query: compareSelector }), aggregatesController.compare);

export default router;
