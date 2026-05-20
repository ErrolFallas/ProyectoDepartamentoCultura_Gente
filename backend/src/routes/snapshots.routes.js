import { Router } from 'express';
import { snapshotsController } from '../controllers/snapshots.controller.js';
import { requireAuth, requireRole } from '../middleware/auth-jwt.js';
import { requireIngestToken } from '../middleware/auth-ingest.js';
import { validate } from '../middleware/validate.js';
import {
  snapshotCloseBody,
  snapshotsListQuery,
  historyQuery
} from '../validators/analytics.schemas.js';

const router = Router();

// El cierre puede dispararse desde un usuario ADMIN logueado O desde n8n
// con el token de ingesta (workflow MonthlySnapshot). Cualquiera de los
// dos credenciales válidos basta.
router.post(
  '/close',
  flexibleAuth,
  validate({ body: snapshotCloseBody }),
  snapshotsController.close
);

router.get('/', requireAuth, validate({ query: snapshotsListQuery }), snapshotsController.list);
router.get('/history', requireAuth, validate({ query: historyQuery }), snapshotsController.history);

function flexibleAuth(req, res, next) {
  if (req.headers['x-ingest-token']) return requireIngestToken(req, res, next);
  return requireAuth(req, res, () => requireRole('ADMIN')(req, res, next));
}

export default router;
