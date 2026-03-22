import { Router } from 'express';
import { listRoles } from '../modules/roles/roles.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Roles disponibles en el sistema
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: Listar roles disponibles (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de roles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 */
router.get('/', listRoles);

export default router;
