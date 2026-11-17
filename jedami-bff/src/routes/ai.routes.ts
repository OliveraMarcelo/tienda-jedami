import { Router } from 'express';
import { aiRateLimit } from '../middlewares/rate-limit.middleware.js';
import {
  aiStatusHandler,
  generateProductDescriptionHandler,
  updateGenerationHandler,
  exportGenerationsHandler,
} from '../modules/ai/ai.controller.js';

// Montado en /admin/ai: ya pasa por authMiddleware + requireRole(admin)
const router = Router();

/**
 * @swagger
 * tags:
 *   name: IA
 *   description: Generación de textos con IA para el admin (descripciones de productos)
 */

/**
 * @swagger
 * /admin/ai/status:
 *   get:
 *     tags: [IA]
 *     summary: Indica si la IA está activada y qué modelo usa
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estado de la IA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     enabled: { type: boolean }
 *                     model: { type: string, nullable: true }
 */
router.get('/status', aiStatusHandler);

/**
 * @swagger
 * /admin/ai/product-description:
 *   post:
 *     tags: [IA]
 *     summary: Genera título, descripción y puntos destacados de un producto
 *     description: Usa el modelo configurado en AI_BASE_URL / AI_MODEL. En un modelo local sin GPU puede tardar hasta un minuto.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: Conjunto kiki }
 *               categoryName: { type: string, example: Conjuntos }
 *               sizes: { type: array, items: { type: string }, example: ['1', '2', '3'] }
 *               colors: { type: array, items: { type: string }, example: [Rosa, Celeste] }
 *               notes: { type: string, example: Algodón peinado, buzo con capucha }
 *               productId: { type: integer, nullable: true }
 *     responses:
 *       201:
 *         description: Texto generado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     generationId: { type: integer }
 *                     model: { type: string }
 *                     durationMs: { type: integer }
 *                     title: { type: string, nullable: true }
 *                     description: { type: string }
 *                     highlights: { type: array, items: { type: string } }
 *       400:
 *         description: Falta el nombre del producto
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       503:
 *         description: IA no configurada o modelo no disponible
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       504:
 *         description: El modelo tardó demasiado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/product-description', aiRateLimit, generateProductDescriptionHandler);

/**
 * @swagger
 * /admin/ai/generations/{id}:
 *   patch:
 *     tags: [IA]
 *     summary: Registra qué hizo el admin con una generación (dataset para fine-tuning)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [accepted, edited, discarded] }
 *               finalText: { type: string, nullable: true, description: Texto que quedó guardado en el producto }
 *               productId: { type: integer, nullable: true }
 *     responses:
 *       200:
 *         description: Actualizado
 *       404:
 *         description: Generación no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/generations/:id', updateGenerationHandler);

/**
 * @swagger
 * /admin/ai/generations/export:
 *   get:
 *     tags: [IA]
 *     summary: Descarga las generaciones aprobadas en JSONL (formato chat) para fine-tuning
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Un ejemplo por línea con mensajes system/user/assistant
 *         headers:
 *           X-Examples-Count:
 *             schema: { type: integer }
 *         content:
 *           application/x-ndjson:
 *             schema: { type: string }
 */
router.get('/generations/export', exportGenerationsHandler);

export default router;
