import { Router } from 'express';
import { register, login, refresh, logout } from '../modules/auth/auth.controller.js';
import { authRateLimit } from '../middlewares/rate-limit.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Registro, login y manejo de tokens
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     email: { type: string }
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       409:
 *         description: Email ya registrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/register', authRateLimit, register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     email: { type: string }
 *                     roles: { type: array, items: { type: string } }
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       401:
 *         description: Credenciales inválidas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/login', authRateLimit, login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renovar access token usando refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token renovado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       401:
 *         description: Refresh token inválido o expirado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/refresh', authRateLimit, refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión (invalida el refresh token)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       204:
 *         description: Sesión cerrada
 *       401:
 *         description: No autenticado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/logout', authMiddleware, logout);

export default router;
