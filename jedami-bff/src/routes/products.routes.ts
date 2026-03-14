import { Router } from 'express';
import {
  createProduct,
  createVariant,
  updateVariantHandler,
  updateProduct,
  getProduct,
  listProducts,
  addImageHandler,
  deleteImageHandler,
} from '../modules/products/products.controller.js';
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
router.put('/:id/variants/:variantId', authMiddleware, requireRole(['admin']), updateVariantHandler);
router.post('/:id/images', authMiddleware, requireRole(['admin']), addImageHandler);
router.delete('/:id/images/:imageId', authMiddleware, requireRole(['admin']), deleteImageHandler);

export default router;
