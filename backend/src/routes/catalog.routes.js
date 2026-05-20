import { Router } from 'express';
import { catalogController } from '../controllers/catalog.controller.js';
import { requireAuth } from '../middleware/auth-jwt.js';

const router = Router();

router.use(requireAuth);

router.get('/questions/pending', catalogController.pendientes);
router.get('/dimensions', catalogController.dimensiones);
router.get('/scales', catalogController.escalas);

export default router;
