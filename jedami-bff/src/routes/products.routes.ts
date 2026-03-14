import { Router } from 'express';
import { createProduct, createVariant, updateProduct, getProduct, listProducts } from '../modules/products/products.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Público — sin auth
router.get('/', listProducts);
router.get('/:id', getProduct);

// Admin — requiere auth + rol admin
router.post('/', authMiddleware, requireRole(['admin']), createProduct);
router.put('/:id', authMiddleware, requireRole(['admin']), updateProduct);
router.post('/:id/variants', authMiddleware, requireRole(['admin']), createVariant);

export default router;
