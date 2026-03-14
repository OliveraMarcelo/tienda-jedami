import { Router } from 'express';
import { register, login, refresh, logout } from '../modules/auth/auth.controller.js';
import { authRateLimit } from '../middlewares/rate-limit.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.post('/refresh', authRateLimit, refresh);
router.post('/logout', authMiddleware, logout);

export default router;
