import { Router } from 'express';
import { me, listUsers } from '../modules/users/users.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../lib/constants.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Perfil del usuario autenticado y listado admin
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Obtener perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/me', authMiddleware, me);

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Listar todos los usuarios (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin permiso
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', authMiddleware, requireRole([ROLES.ADMIN]), listUsers);

export default router;
