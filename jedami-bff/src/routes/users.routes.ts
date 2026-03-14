import { Router } from 'express';
import { me, listUsers } from '../modules/users/users.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

router.get('/me', authMiddleware, me);
router.get('/', authMiddleware, requireRole(['admin']), listUsers);

export default router;
