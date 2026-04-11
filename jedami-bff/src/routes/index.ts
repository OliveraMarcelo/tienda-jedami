import { Router } from 'express';
import authRoutes from './auth.routes.js';
import rolesRoutes from './roles.routes.js';
import usersRoutes from './users.routes.js';
import productsRoutes from './products.routes.js';
import categoriesRoutes from './categories.routes.js';
import ordersRoutes from './orders.routes.js';
import paymentsRoutes from './payments.routes.js';
import configRoutes from './config.routes.js';
import adminRoutes from './admin.routes.js';
import posRoutes from './pos.routes.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { assignRole, removeRoleFromUser } from '../modules/roles/roles.controller.js';
import { ROLES } from '../lib/constants.js';

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check del servidor
 *     responses:
 *       200:
 *         description: Servidor operativo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, example: ok }
 */
router.get('/health', (_req, res) => {
  res.status(200).json({ data: { status: 'ok' } });
});

// Config — público
router.use('/config', configRoutes);

// Admin — requiere auth + admin
router.use('/admin', authMiddleware, requireRole([ROLES.ADMIN]), adminRoutes);

// Auth — público
router.use('/auth', authRoutes);

// Perfil propio — requiere solo auth
router.use('/users', usersRoutes);

// Roles — requiere auth + admin
router.use('/roles', authMiddleware, requireRole([ROLES.ADMIN]), rolesRoutes);

/**
 * @swagger
 * /users/{userId}/roles:
 *   post:
 *     tags: [Users]
 *     summary: Asignar rol a un usuario (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId]
 *             properties:
 *               roleId: { type: integer }
 *     responses:
 *       201:
 *         description: Rol asignado
 *       404:
 *         description: Usuario o rol no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: El usuario ya tiene ese rol
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/users/:userId/roles', authMiddleware, requireRole([ROLES.ADMIN]), assignRole);

/**
 * @swagger
 * /users/{userId}/roles/{roleId}:
 *   delete:
 *     tags: [Users]
 *     summary: Remover rol de un usuario (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Rol removido
 *       404:
 *         description: Asignación no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/users/:userId/roles/:roleId', authMiddleware, requireRole([ROLES.ADMIN]), removeRoleFromUser);

// Productos — rutas mixtas (público para GET, admin para mutaciones)
router.use('/products', productsRoutes);

// Categorías — público para GET, admin para mutaciones
router.use('/categories', categoriesRoutes);

// Pedidos — requiere auth + wholesale
router.use('/orders', ordersRoutes);

// Pagos — checkout autenticado + webhook público
router.use('/payments', paymentsRoutes);

// POS — gestión de dispositivos Point (solo admin)
router.use('/pos', posRoutes);

export default router;
