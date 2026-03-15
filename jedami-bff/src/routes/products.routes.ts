import { Router } from 'express';
import {
  createProduct,
  createVariant,
  updateProduct,
  updateProductPricesHandler,
  getProduct,
  listProducts,
  listSizesHandler,
  listColorsHandler,
  uploadImageHandler,
  deleteImageHandler,
  deleteProductHandler,
  deleteVariantHandler,
  updateStockHandler,
} from '../modules/products/products.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

// Público — sin auth (antes de /:id para evitar conflictos)
router.get('/sizes', listSizesHandler);
router.get('/colors', listColorsHandler);
router.get('/', listProducts);
router.get('/:id', getProduct);

// Admin — requiere auth + rol admin
router.post('/', authMiddleware, requireRole(['admin']), createProduct);
router.put('/:id', authMiddleware, requireRole(['admin']), updateProduct);
router.put('/:id/prices', authMiddleware, requireRole(['admin']), updateProductPricesHandler);
router.post('/:id/variants', authMiddleware, requireRole(['admin']), createVariant);
router.post('/:id/images/upload', authMiddleware, requireRole(['admin']), uploadImageHandler);
router.delete('/:id/images/:imageId', authMiddleware, requireRole(['admin']), deleteImageHandler);
router.delete('/:id', authMiddleware, requireRole(['admin']), deleteProductHandler);
router.delete('/:id/variants/:variantId', authMiddleware, requireRole(['admin']), deleteVariantHandler);
router.patch('/:id/variants/:variantId/stock', authMiddleware, requireRole(['admin']), updateStockHandler);

export default router;
