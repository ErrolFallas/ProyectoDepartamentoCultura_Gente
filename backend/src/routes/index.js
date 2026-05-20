import { Router } from 'express';
import { ping } from '../db/pool.js';
import authRoutes from './auth.routes.js';
import ingestRoutes from './ingest.routes.js';
import catalogRoutes from './catalog.routes.js';
import classificationsRoutes from './classifications.routes.js';
import aggregatesRoutes from './aggregates.routes.js';
import snapshotsRoutes from './snapshots.routes.js';
import rankingsRoutes from './rankings.routes.js';
import alertsRoutes from './alerts.routes.js';
import temporalRoutes from './temporal.routes.js';
import orgRoutes from './org.routes.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const db = await ping().catch(() => false);
  res.json({ status: 'ok', db: db ? 'up' : 'down', uptime: process.uptime() });
});

router.use('/auth', authRoutes);
router.use('/', ingestRoutes); // /responses/ingest y /responses/ingest/batch
router.use('/catalog', catalogRoutes);
router.use('/classifications', classificationsRoutes);
router.use('/aggregates', aggregatesRoutes);
router.use('/snapshots', snapshotsRoutes);
router.use('/rankings', rankingsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/temporal', temporalRoutes);
router.use('/', orgRoutes); // /companies, /companies/:id/departments

export default router;
