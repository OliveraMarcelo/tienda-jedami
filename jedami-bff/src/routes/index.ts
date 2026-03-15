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
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { assignRole } from '../modules/roles/roles.controller.js';
import { ROLES } from '../lib/constants.js';

const router = Router();

// Health check
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

// Asignación de roles a usuarios — requiere auth + admin
router.post('/users/:userId/roles', authMiddleware, requireRole([ROLES.ADMIN]), assignRole);

// Productos — rutas mixtas (público para GET, admin para mutaciones)
router.use('/products', productsRoutes);

// Categorías — público para GET, admin para mutaciones
router.use('/categories', categoriesRoutes);

// Pedidos — requiere auth + wholesale
router.use('/orders', ordersRoutes);

// Pagos — checkout autenticado + webhook público
router.use('/payments', paymentsRoutes);

export default router;
