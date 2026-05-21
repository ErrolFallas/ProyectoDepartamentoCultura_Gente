import { Router } from 'express';
import { alertsController } from '../controllers/alerts.controller.js';
import { requireAuth } from '../middleware/auth-jwt.js';
import { requireIngestToken } from '../middleware/auth-ingest.js';
import { validate } from '../middleware/validate.js';
import {
  alertsListQuery,
  alertsRecalcBody,
  alertAtenderBody,
  alertDesmarcarBody
} from '../validators/analytics.schemas.js';

const router = Router();

router.get('/', requireAuth, validate({ query: alertsListQuery }), alertsController.list);
router.get('/focos', requireAuth, alertsController.focos);

router.post(
  '/recalculate',
  flexibleAuth,
  validate({ body: alertsRecalcBody }),
  alertsController.recalculate
);

router.post(
  '/:id/atender',
  requireAuth,
  validate({ body: alertAtenderBody }),
  alertsController.atender
);

router.post(
  '/:id/desmarcar',
  requireAuth,
  validate({ body: alertDesmarcarBody }),
  alertsController.desmarcar
);

router.get('/:id/detalle', requireAuth, alertsController.detalle);

function flexibleAuth(req, res, next) {
  if (req.headers['x-ingest-token']) return requireIngestToken(req, res, next);
  return requireAuth(req, res, next);
}

export default router;
