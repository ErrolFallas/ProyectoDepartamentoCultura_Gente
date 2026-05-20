import { Router } from 'express';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth-jwt.js';
import { companiesRepo } from '../repositories/companies.repo.js';
import { departmentsRepo } from '../repositories/departments.repo.js';

const router = Router();
router.use(requireAuth);

router.get('/companies', asyncHandler(async (_req, res) => {
  const items = await companiesRepo.findAll();
  res.json({ items });
}));

router.get('/companies/:id/departments', asyncHandler(async (req, res) => {
  const companyId = Number(req.params.id);
  const items = await departmentsRepo.findByCompany(companyId);
  res.json({ items });
}));

export default router;
