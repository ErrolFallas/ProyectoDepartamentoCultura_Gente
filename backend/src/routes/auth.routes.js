import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth-jwt.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validators/auth.schemas.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), authController.login);
router.get('/me', requireAuth, authController.me);

export default router;
