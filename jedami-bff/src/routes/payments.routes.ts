import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../lib/constants.js';
import { checkout, webhook, retryPaymentHandler, processPaymentHandler, smartCheckoutHandler } from '../modules/payments/payments.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Checkout y procesamiento de pagos con Mercado Pago
 */

/**
 * @swagger
 * /payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Webhook de Mercado Pago (uso interno de MP)
 *     description: Recibe notificaciones automáticas de Mercado Pago. No llamar manualmente.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action: { type: string, example: payment.updated }
 *               data:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *     responses:
 *       200:
 *         description: Webhook procesado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received: { type: boolean }
 */
router.post('/webhook', webhook);

/**
 * @swagger
 * /payments/checkout:
 *   post:
 *     tags: [Payments]
 *     summary: Iniciar checkout unificado con soporte de múltiples gateways por tipo de cliente
 *     description: |
 *       Si el usuario tiene un solo gateway activo lo usa directamente.
 *       Si tiene múltiples, retorna `{ type: 'select', options: [...] }` para que el frontend muestre el selector.
 *       Si `selectedGateway` está en el body, lo usa directamente (previa validación).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: integer }
 *               selectedGateway:
 *                 type: string
 *                 enum: [checkout_pro, checkout_api, bank_transfer, mp_point]
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Resultado de checkout o selector de gateways
 *       422:
 *         description: Sin gateways disponibles para el tipo de cliente
 */
router.post('/checkout', authMiddleware, smartCheckoutHandler);

/**
 * @swagger
 * /payments/{orderId}/checkout:
 *   post:
 *     tags: [Payments]
 *     summary: Iniciar checkout para un pedido
 *     description: |
 *       Si el gateway activo es `checkout_pro`, devuelve una URL de redirección a MP.
 *       Si el gateway activo es `checkout_api`, devuelve la publicKey para montar el CardPaymentBrick.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos para iniciar el pago
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   oneOf:
 *                     - type: object
 *                       properties:
 *                         type: { type: string, example: redirect }
 *                         checkoutUrl: { type: string }
 *                     - type: object
 *                       properties:
 *                         type: { type: string, example: preference }
 *                         publicKey: { type: string }
 *       403:
 *         description: Sin perfil de comprador o acceso denegado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Pedido ya pagado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:orderId/checkout', authMiddleware, checkout);

/**
 * @swagger
 * /payments/{orderId}/retry:
 *   post:
 *     tags: [Payments]
 *     summary: Reintentar pago fallido o rechazado (Checkout Pro)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Nueva URL de checkout generada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     checkoutUrl: { type: string }
 *       422:
 *         description: El pedido no está en estado reinventable
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:orderId/retry', authMiddleware, retryPaymentHandler);

/**
 * @swagger
 * /payments/{orderId}/process:
 *   post:
 *     tags: [Payments]
 *     summary: Procesar pago con tarjeta (Checkout API — CardPaymentBrick)
 *     description: |
 *       Requiere que el gateway activo sea `checkout_api`.
 *       Recibe el formData nativo del CardPaymentBrick de Mercado Pago.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, payment_method_id, installments, payer]
 *             properties:
 *               token: { type: string, description: Token generado por el CardPaymentBrick }
 *               payment_method_id: { type: string, example: visa }
 *               issuer_id: { type: string, nullable: true }
 *               installments: { type: integer, example: 1 }
 *               payer:
 *                 type: object
 *                 required: [email, identification]
 *                 properties:
 *                   email: { type: string, format: email }
 *                   identification:
 *                     type: object
 *                     properties:
 *                       type: { type: string, example: DNI }
 *                       number: { type: string }
 *     responses:
 *       200:
 *         description: Resultado del procesamiento del pago
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, enum: [approved, rejected, pending] }
 *                     statusDetail: { type: string, nullable: true }
 *       400:
 *         description: Gateway activo no es checkout_api o datos incompletos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin permiso
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:orderId/process', authMiddleware, requireRole([ROLES.WHOLESALE, ROLES.RETAIL, ROLES.ADMIN]), processPaymentHandler);

export default router;
