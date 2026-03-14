import { Router } from 'express';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../modules/categories/categories.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Público — sin auth
router.get('/', listCategories);

// Admin — requiere auth + rol admin
router.post('/', authMiddleware, requireRole(['admin']), createCategory);
router.put('/:id', authMiddleware, requireRole(['admin']), updateCategory);
router.delete('/:id', authMiddleware, requireRole(['admin']), deleteCategory);

export default router;
