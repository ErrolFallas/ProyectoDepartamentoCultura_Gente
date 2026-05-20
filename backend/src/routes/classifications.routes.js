import { Router } from 'express';
import { classificationsController } from '../controllers/classifications.controller.js';
import { requireAuth, requireRole } from '../middleware/auth-jwt.js';
import { validate } from '../middleware/validate.js';
import { confirmarClasificacionSchema, idParamSchema } from '../validators/classifications.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', classificationsController.list);
router.post(
  '/:id/confirm',
  requireRole('ADMIN', 'ANALISTA'),
  validate({ params: idParamSchema, body: confirmarClasificacionSchema }),
  classificationsController.confirm
);

export default router;
