import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { checkout, webhook } from '../modules/payments/payments.controller.js';

const router = Router();

// Webhook — público (MP no envía token de usuario)
router.post('/webhook', webhook);

// Checkout — requiere autenticación
router.post('/:orderId/checkout', authMiddleware, checkout);

export default router;
