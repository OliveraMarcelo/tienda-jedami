import { Router } from 'express';
import {
  register, login, refresh, logout,
  verifyEmail, resendVerification, forgotPassword, resetPassword, google,
} from '../modules/auth/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { authRateLimit, loginRateLimit } from '../middlewares/rate-limit.middleware.js';

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
 *                 minLength: 8
 *               customerType:
 *                 type: string
 *                 enum: [retail, wholesale]
 *     responses:
 *       201:
 *         description: |
 *           Usuario creado. Si `verificationRequired` es true se envió un código de 6 dígitos
 *           al email y hay que confirmarlo con POST /auth/verify-email antes de iniciar sesión.
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
 *                     createdAt: { type: string, format: date-time }
 *                     verificationRequired: { type: boolean }
 *       400:
 *         description: Datos inválidos (email o contraseña de menos de 8 caracteres)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
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
 *       403:
 *         description: |
 *           Email sin verificar (type `.../errors/email-not-verified`). Se reenvía un código
 *           automáticamente; confirmar con POST /auth/verify-email.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Demasiados intentos fallidos
 */
router.post('/login', loginRateLimit, login);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Confirmar el email con el código de 6 dígitos (inicia sesión)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, example: '123456' }
 *     responses:
 *       200:
 *         description: Email confirmado; devuelve token y refreshToken
 *       400:
 *         description: Código incorrecto, vencido o demasiados intentos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: El email ya estaba confirmado
 */
router.post('/verify-email', authRateLimit, verifyEmail);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Reenviar el código de verificación (máximo uno por minuto)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Respuesta genérica (no revela si el email existe)
 */
router.post('/resend-verification', authRateLimit, resendVerification);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Pedir un link por email para restablecer la contraseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Respuesta genérica (no revela si el email existe). El link vence en 1 hora.
 */
router.post('/forgot-password', authRateLimit, forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Elegir contraseña nueva con el token del email (inicia sesión)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Contraseña cambiada; cierra las otras sesiones y devuelve token y refreshToken
 *       400:
 *         description: Link inválido/vencido o contraseña muy corta
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/reset-password', authRateLimit, resetPassword);

/**
 * @swagger
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Ingresar o crear cuenta con Google
 *     description: |
 *       Recibe el ID token ("credential") que entrega el botón de Google Identity Services.
 *       Si el email ya tiene cuenta la vincula; si no, crea una cuenta sin contraseña.
 *       Requiere GOOGLE_CLIENT_ID configurado (si no, responde 404).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credential]
 *             properties:
 *               credential: { type: string }
 *               customerType: { type: string, enum: [retail, wholesale], description: 'Solo para cuentas nuevas' }
 *     responses:
 *       200:
 *         description: Devuelve token y refreshToken
 *       401:
 *         description: Token de Google inválido o email sin verificar
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Login con Google deshabilitado
 *       409:
 *         description: El email está vinculado a otra cuenta de Google
 */
router.post('/google', authRateLimit, google);

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
router.post('/refresh', refresh);

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
