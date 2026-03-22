import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { createOrder, addItems, getMyOrders, getOrderById, cancelOrder, updateOrderNotes } from '../modules/orders/orders.controller.js';
import { ROLES } from '../lib/constants.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Pedidos mayoristas y minoristas
 */

/**
 * @swagger
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Crear pedido
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [purchaseType]
 *             properties:
 *               purchaseType:
 *                 type: string
 *                 enum: [curva, cantidad, retail]
 *               items:
 *                 type: array
 *                 description: Requerido para purchaseType=retail o cantidad
 *                 items:
 *                   type: object
 *                   required: [variantId, quantity]
 *                   properties:
 *                     variantId: { type: integer }
 *                     quantity: { type: integer }
 *     responses:
 *       201:
 *         description: Pedido creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Order' }
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       422:
 *         description: Stock insuficiente
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', authMiddleware, requireRole([ROLES.WHOLESALE, ROLES.RETAIL]), createOrder);

/**
 * @swagger
 * /orders/{orderId}/items:
 *   post:
 *     tags: [Orders]
 *     summary: Agregar ítems a un pedido curva (solo mayorista)
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
 *             required: [productId, quantity]
 *             properties:
 *               productId: { type: integer }
 *               quantity: { type: integer }
 *               sizeId: { type: integer }
 *     responses:
 *       201:
 *         description: Ítem agregado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/OrderItem' }
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:orderId/items', authMiddleware, requireRole([ROLES.WHOLESALE]), addItems);

/**
 * @swagger
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: Listar mis pedidos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de pedidos del comprador autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Order' }
 */
router.get('/', authMiddleware, requireRole([ROLES.WHOLESALE, ROLES.RETAIL]), getMyOrders);

/**
 * @swagger
 * /orders/{orderId}:
 *   get:
 *     tags: [Orders]
 *     summary: Obtener pedido por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Detalle del pedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Order' }
 *       403:
 *         description: Sin permiso para ver este pedido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:orderId', authMiddleware, requireRole([ROLES.WHOLESALE, ROLES.RETAIL]), getOrderById);

/**
 * @swagger
 * /orders/{orderId}/cancel:
 *   patch:
 *     tags: [Orders]
 *     summary: Cancelar pedido
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pedido cancelado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     status: { type: string, example: cancelled }
 *       409:
 *         description: No se puede cancelar (ya está pagado o cancelado)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:orderId/cancel', authMiddleware, requireRole([ROLES.WHOLESALE, ROLES.RETAIL, ROLES.ADMIN]), cancelOrder);

/**
 * @swagger
 * /orders/{orderId}/notes:
 *   patch:
 *     tags: [Orders]
 *     summary: Agregar o actualizar notas del pedido
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
 *             properties:
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Notas actualizadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     notes: { type: string, nullable: true }
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:orderId/notes',  authMiddleware, requireRole([ROLES.WHOLESALE, ROLES.RETAIL]), updateOrderNotes);

export default router;
