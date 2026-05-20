import { asyncHandler } from '../middleware/async-handler.js';
import * as authService from '../services/auth.service.js';

export const authController = {
  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  }),

  me: asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
};
