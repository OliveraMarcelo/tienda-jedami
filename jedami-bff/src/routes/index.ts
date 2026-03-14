import { Router } from 'express';
import authRoutes from './auth.routes.js';
import rolesRoutes from './roles.routes.js';
import usersRoutes from './users.routes.js';
import productsRoutes from './products.routes.js';
import ordersRoutes from './orders.routes.js';
import paymentsRoutes from './payments.routes.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { assignRole } from '../modules/roles/roles.controller.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.status(200).json({ data: { status: 'ok' } });
});

// Auth — público
router.use('/auth', authRoutes);

// Perfil propio — requiere solo auth
router.use('/users', usersRoutes);

// Roles — requiere auth + admin
router.use('/roles', authMiddleware, requireRole(['admin']), rolesRoutes);

// Asignación de roles a usuarios — requiere auth + admin
router.post('/users/:userId/roles', authMiddleware, requireRole(['admin']), assignRole);

// Productos — rutas mixtas (público para GET, admin para mutaciones)
router.use('/products', productsRoutes);

// Pedidos — requiere auth + wholesale
router.use('/orders', ordersRoutes);

// Pagos — checkout autenticado + webhook público
router.use('/payments', paymentsRoutes);

export default router;
