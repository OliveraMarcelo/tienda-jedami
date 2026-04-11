/**
 * Rutas admin de descuentos — montadas bajo /admin/products/:id/discount-rules
 * Auth y requireRole(ADMIN) ya aplicados a nivel del router /admin en index.ts
 */
import { Router } from 'express';
import {
  getAdminDiscountRules,
  createQuantityRuleHandler,
  updateQuantityRuleHandler,
  deleteQuantityRuleHandler,
  createCurvaRuleHandler,
  updateCurvaRuleHandler,
  deleteCurvaRuleHandler,
  updateMinQuantityHandler,
} from '../modules/discounts/discounts.controller.js';

const router = Router({ mergeParams: true });

/**
 * @swagger
 * /admin/products/{id}/discount-rules:
 *   get:
 *     tags: [Discounts]
 *     summary: Listar todos los escalones de un producto (admin, incluye inactivos)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Todos los escalones del producto
 */
router.get('/', getAdminDiscountRules);

/**
 * @swagger
 * /admin/products/{id}/discount-rules/quantity:
 *   post:
 *     tags: [Discounts]
 *     summary: Crear escalón de descuento por cantidad (admin)
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
 *             required: [minQuantity, discountPct]
 *             properties:
 *               minQuantity: { type: integer, minimum: 1 }
 *               discountPct: { type: number, minimum: 0.01, maximum: 99.99 }
 *     responses:
 *       201:
 *         description: Escalón creado
 *       409:
 *         description: Ya existe un escalón con ese minQuantity
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/quantity', createQuantityRuleHandler);
router.patch('/quantity/:ruleId', updateQuantityRuleHandler);
router.delete('/quantity/:ruleId', deleteQuantityRuleHandler);

/**
 * @swagger
 * /admin/products/{id}/discount-rules/curva:
 *   post:
 *     tags: [Discounts]
 *     summary: Crear escalón de descuento por curvas (admin)
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
 *             required: [minCurves, discountPct]
 *             properties:
 *               minCurves: { type: integer, minimum: 1 }
 *               discountPct: { type: number, minimum: 0.01, maximum: 99.99 }
 *     responses:
 *       201:
 *         description: Escalón creado
 *       409:
 *         description: Ya existe un escalón con ese minCurves
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/curva', createCurvaRuleHandler);
router.patch('/curva/:ruleId', updateCurvaRuleHandler);
router.delete('/curva/:ruleId', deleteCurvaRuleHandler);

/**
 * @swagger
 * /admin/products/{id}/min-quantity:
 *   patch:
 *     tags: [Discounts]
 *     summary: Actualizar mínimo de compra del producto (admin)
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
 *             properties:
 *               minQuantity: { type: integer, nullable: true, minimum: 1 }
 *     responses:
 *       200:
 *         description: Mínimo actualizado
 */
router.patch('/min-quantity', updateMinQuantityHandler);

export default router;
