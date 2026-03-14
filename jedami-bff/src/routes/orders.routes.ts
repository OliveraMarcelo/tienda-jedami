import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { createOrder, addItems, getMyOrders, getOrderById } from '../modules/orders/orders.controller.js';

const router = Router();

// POST / y GET requieren auth + rol retail o wholesale
router.post('/', authMiddleware, requireRole(['wholesale', 'retail']), createOrder);
router.post('/:orderId/items', authMiddleware, requireRole(['wholesale']), addItems);
router.get('/', authMiddleware, requireRole(['wholesale', 'retail']), getMyOrders);
router.get('/:orderId', authMiddleware, requireRole(['wholesale', 'retail']), getOrderById);

export default router;
