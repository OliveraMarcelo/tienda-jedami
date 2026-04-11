import { Router } from 'express';
import {
  createProduct,
  createVariant,
  updateProduct,
  updateProductPricesHandler,
  getProduct,
  listProducts,
  listSizesHandler,
  listColorsHandler,
  createSizeHandler,
  deleteSizeHandler,
  updateSizeHandler,
  createColorHandler,
  deleteColorHandler,
  updateColorHandler,
  uploadImageHandler,
  deleteImageHandler,
  deleteProductHandler,
  deleteVariantHandler,
  updateStockHandler,
  reorderImagesHandler,
} from '../modules/products/products.controller.js';
import { getPublicDiscountRules } from '../modules/discounts/discounts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../lib/constants.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Catálogo de productos, variantes, talles, colores e imágenes
 */

/**
 * @swagger
 * /products/sizes:
 *   get:
 *     tags: [Products]
 *     summary: Listar talles disponibles
 *     responses:
 *       200:
 *         description: Lista de talles
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
 *                       active: { type: boolean }
 */
router.get('/sizes', listSizesHandler);

/**
 * @swagger
 * /products/colors:
 *   get:
 *     tags: [Products]
 *     summary: Listar colores disponibles
 *     responses:
 *       200:
 *         description: Lista de colores
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
 *                       active: { type: boolean }
 */
router.get('/colors', listColorsHandler);

/**
 * @swagger
 * /products/sizes:
 *   post:
 *     tags: [Products]
 *     summary: Crear talle (solo admin)
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
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Talle creado
 *       400:
 *         description: Datos inválidos o talle duplicado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/sizes',        authMiddleware, requireRole([ROLES.ADMIN]), createSizeHandler);

/**
 * @swagger
 * /products/sizes/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Soft-delete de talle (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Talle desactivado
 *       404:
 *         description: Talle no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/sizes/:id',  authMiddleware, requireRole([ROLES.ADMIN]), deleteSizeHandler);

/**
 * @swagger
 * /products/sizes/{id}:
 *   patch:
 *     tags: [Products]
 *     summary: Actualizar talle (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               active: { type: boolean }
 *     responses:
 *       200:
 *         description: Talle actualizado
 *       404:
 *         description: Talle no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/sizes/:id',   authMiddleware, requireRole([ROLES.ADMIN]), updateSizeHandler);

/**
 * @swagger
 * /products/colors:
 *   post:
 *     tags: [Products]
 *     summary: Crear color (solo admin)
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
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Color creado
 *       400:
 *         description: Datos inválidos o color duplicado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/colors',       authMiddleware, requireRole([ROLES.ADMIN]), createColorHandler);

/**
 * @swagger
 * /products/colors/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Soft-delete de color (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Color desactivado
 *       404:
 *         description: Color no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/colors/:id', authMiddleware, requireRole([ROLES.ADMIN]), deleteColorHandler);

/**
 * @swagger
 * /products/colors/{id}:
 *   patch:
 *     tags: [Products]
 *     summary: Actualizar color (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               active: { type: boolean }
 *     responses:
 *       200:
 *         description: Color actualizado
 *       404:
 *         description: Color no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/colors/:id',  authMiddleware, requireRole([ROLES.ADMIN]), updateColorHandler);

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: Listar productos del catálogo (con paginación y filtros)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: categoryId
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Búsqueda full-text por nombre y descripción
 *     responses:
 *       200:
 *         description: Lista paginada de productos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 */
/**
 * @swagger
 * /products/{id}/discount-rules:
 *   get:
 *     tags: [Discounts]
 *     summary: Obtener escalones de descuento activos de un producto (público)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Escalones de descuento activos por cantidad y curva
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     quantityRules: { type: array, items: { type: object } }
 *                     curvaRules: { type: array, items: { type: object } }
 */
router.get('/:id/discount-rules', getPublicDiscountRules);

router.get('/', listProducts);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Obtener producto por ID (con variantes e imágenes)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Detalle del producto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Product' }
 *       404:
 *         description: Producto no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', getProduct);

/**
 * @swagger
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Crear producto (solo admin)
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
 *               name: { type: string }
 *               description: { type: string, nullable: true }
 *               categoryId: { type: integer, nullable: true }
 *     responses:
 *       201:
 *         description: Producto creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Product' }
 */
router.post('/', authMiddleware, requireRole([ROLES.ADMIN]), createProduct);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Actualizar producto (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string, nullable: true }
 *               categoryId: { type: integer, nullable: true }
 *     responses:
 *       200:
 *         description: Producto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Product' }
 *       404:
 *         description: Producto no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/:id', authMiddleware, requireRole([ROLES.ADMIN]), updateProduct);

/**
 * @swagger
 * /products/{id}/prices:
 *   put:
 *     tags: [Products]
 *     summary: Actualizar precios de variantes de un producto (solo admin)
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
 *             required: [prices]
 *             properties:
 *               prices:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [variantId]
 *                   properties:
 *                     variantId: { type: integer }
 *                     retailPrice: { type: number, nullable: true }
 *                     wholesalePrice: { type: number, nullable: true }
 *     responses:
 *       200:
 *         description: Precios actualizados
 */
router.put('/:id/prices', authMiddleware, requireRole([ROLES.ADMIN]), updateProductPricesHandler);

/**
 * @swagger
 * /products/{id}/variants:
 *   post:
 *     tags: [Products]
 *     summary: Crear variante de producto (solo admin)
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
 *             required: [sizeId, colorId]
 *             properties:
 *               sizeId: { type: integer }
 *               colorId: { type: integer }
 *               stock: { type: integer, default: 0 }
 *               retailPrice: { type: number, nullable: true }
 *               wholesalePrice: { type: number, nullable: true }
 *     responses:
 *       201:
 *         description: Variante creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Variant' }
 *       409:
 *         description: La combinación talle/color ya existe
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:id/variants', authMiddleware, requireRole([ROLES.ADMIN]), createVariant);

/**
 * @swagger
 * /products/{id}/images/upload:
 *   post:
 *     tags: [Products]
 *     summary: Subir imagen de producto (solo admin)
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Imagen subida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/ProductImage' }
 *       400:
 *         description: Imagen no enviada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:id/images/upload', authMiddleware, requireRole([ROLES.ADMIN]), uploadImageHandler);

/**
 * @swagger
 * /products/{id}/images/reorder:
 *   patch:
 *     tags: [Products]
 *     summary: Reordenar imágenes de un producto (solo admin)
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
 *             type: array
 *             items:
 *               type: object
 *               required: [id, sortOrder]
 *               properties:
 *                 id: { type: integer }
 *                 sortOrder: { type: integer }
 *     responses:
 *       200:
 *         description: Imágenes reordenadas
 */
router.patch('/:id/images/reorder', authMiddleware, requireRole([ROLES.ADMIN]), reorderImagesHandler);

/**
 * @swagger
 * /products/{id}/images/{imageId}:
 *   delete:
 *     tags: [Products]
 *     summary: Eliminar imagen de producto (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Imagen eliminada
 *       404:
 *         description: Imagen no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id/images/:imageId', authMiddleware, requireRole([ROLES.ADMIN]), deleteImageHandler);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Eliminar producto (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Producto eliminado
 *       404:
 *         description: Producto no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', authMiddleware, requireRole([ROLES.ADMIN]), deleteProductHandler);

/**
 * @swagger
 * /products/{id}/variants/{variantId}:
 *   delete:
 *     tags: [Products]
 *     summary: Eliminar variante de producto (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Variante eliminada
 *       404:
 *         description: Variante no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id/variants/:variantId', authMiddleware, requireRole([ROLES.ADMIN]), deleteVariantHandler);

/**
 * @swagger
 * /products/{id}/variants/{variantId}/stock:
 *   patch:
 *     tags: [Products]
 *     summary: Actualizar stock de una variante (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: variantId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stock]
 *             properties:
 *               stock: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Stock actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Variant' }
 *       404:
 *         description: Variante no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/variants/:variantId/stock', authMiddleware, requireRole([ROLES.ADMIN]), updateStockHandler);

export default router;
