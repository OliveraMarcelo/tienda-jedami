import { Router } from 'express';
import { getDashboard, getAdminPayments, getAdminUsers, getPendingFulfillment, fulfillOrderItem, dispatchOrder, decrementItemStock, confirmBankTransfer, updateVariantStock } from '../modules/admin/admin.controller.js';
import { getAllBanners, uploadBanner, reorderBanners, updateBanner, deleteBanner } from '../modules/admin/banners.controller.js';
import { getAllAnnouncements, createAnnouncement, reorderAnnouncements, updateAnnouncement, deleteAnnouncement } from '../modules/admin/announcements.controller.js';
import { uploadBannersMiddleware, uploadAnnouncementsMiddleware } from '../config/upload.js';
import discountsAdminRouter from './discounts.routes.js';
import { updateMinQuantityHandler } from '../modules/discounts/discounts.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Panel de administración — requiere rol admin en todos los endpoints
 */

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Obtener métricas del dashboard de ventas
 *     description: Devuelve totales de ventas, pedidos, pagos y top productos. Cacheado 5 minutos en Redis.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas del dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRevenue: { type: number }
 *                     totalOrders: { type: integer }
 *                     paidOrders: { type: integer }
 *                     pendingOrders: { type: integer }
 *                     topProducts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId: { type: integer }
 *                           name: { type: string }
 *                           totalSold: { type: integer }
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /admin/orders/pending-fulfillment:
 *   get:
 *     tags: [Admin]
 *     summary: Listar pedidos curva pendientes de despacho
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pedidos con ítems sin cumplir
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Order' }
 */
router.get('/orders/pending-fulfillment', getPendingFulfillment);

/**
 * @swagger
 * /admin/orders/{orderId}/items/{itemId}/fulfill:
 *   patch:
 *     tags: [Admin]
 *     summary: Asignar color y confirmar despacho de un ítem de pedido curva
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [colorId]
 *             properties:
 *               colorId: { type: integer }
 *     responses:
 *       200:
 *         description: Ítem despachado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/OrderItem' }
 *       404:
 *         description: Pedido o ítem no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/orders/:orderId/items/:itemId/fulfill', fulfillOrderItem);

/**
 * @swagger
 * /admin/orders/{id}/dispatch:
 *   post:
 *     tags: [Admin]
 *     summary: Marcar pedido como despachado (sin modificar stock)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pedido marcado como despachado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId: { type: integer }
 *                     status: { type: string, example: shipped }
 *                     shippedAt: { type: string, format: date-time }
 *       422:
 *         description: El pedido no está en estado pagado
 */
router.post('/orders/:id/dispatch', dispatchOrder);

/**
 * @swagger
 * /admin/orders/{orderId}/items/{itemId}/decrement-stock:
 *   patch:
 *     tags: [Admin]
 *     summary: Descontar stock de la variante asignada a un ítem
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Stock decrementado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     itemId: { type: integer }
 *                     variantId: { type: integer }
 *                     stockRemaining: { type: integer }
 *       422:
 *         description: Sin variante asignada o stock insuficiente
 */
router.patch('/orders/:orderId/items/:itemId/decrement-stock', decrementItemStock);

/**
 * @swagger
 * /admin/orders/{id}/confirm-transfer:
 *   post:
 *     tags: [Admin]
 *     summary: Confirmar manualmente un pago por transferencia bancaria
 *     description: Marca el pago como aprobado y el pedido como pagado. Solo aplica a pagos con payment_method='bank_transfer' en estado pending.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID del pedido
 *     responses:
 *       200:
 *         description: Transferencia confirmada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     orderId: { type: integer }
 *                     status: { type: string, example: paid }
 *       404:
 *         description: No hay pago pendiente de transferencia para este pedido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/orders/:id/confirm-transfer', confirmBankTransfer);

// Descuentos por volumen — escalones y mínimo de compra por producto
router.use('/products/:id/discount-rules', discountsAdminRouter);
router.patch('/products/:id/min-quantity', updateMinQuantityHandler);

// Ajuste de stock desde app desktop
router.patch('/products/:productId/variants/:variantId/stock', updateVariantStock);

/**
 * @swagger
 * /admin/payments:
 *   get:
 *     tags: [Admin]
 *     summary: Listar todos los pagos con detalle de pedidos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de pagos
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
 *                       orderId: { type: integer }
 *                       status: { type: string }
 *                       amount: { type: number, nullable: true }
 *                       mpPaymentId: { type: string, nullable: true }
 *                       customerEmail: { type: string }
 *                       notes: { type: string, nullable: true }
 *                       createdAt: { type: string, format: date-time }
 */
router.get('/payments',  getAdminPayments);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Listar usuarios con sus roles
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
 */
router.get('/users',     getAdminUsers);

/**
 * @swagger
 * /admin/banners:
 *   get:
 *     tags: [Admin]
 *     summary: Listar todos los banners (incluye inactivos)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista completa de banners
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Banner' }
 */
router.get('/banners',           getAllBanners);

/**
 * @swagger
 * /admin/banners:
 *   post:
 *     tags: [Admin]
 *     summary: Subir nuevo banner
 *     security:
 *       - bearerAuth: []
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
 *               linkUrl:
 *                 type: string
 *                 description: URL destino al hacer click (puede ser ruta interna como /catalogo)
 *     responses:
 *       201:
 *         description: Banner creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Banner' }
 *       400:
 *         description: Imagen no enviada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/banners',          uploadBannersMiddleware, uploadBanner);

/**
 * @swagger
 * /admin/banners/reorder:
 *   patch:
 *     tags: [Admin]
 *     summary: Reordenar banners
 *     security:
 *       - bearerAuth: []
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
 *         description: Banners reordenados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     reordered: { type: boolean }
 *       400:
 *         description: Body inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/banners/reorder', reorderBanners);

/**
 * @swagger
 * /admin/banners/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Actualizar banner (activar/desactivar, cambiar link)
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
 *               active: { type: boolean }
 *               linkUrl: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Banner actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Banner' }
 *       404:
 *         description: Banner no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/banners/:id',     updateBanner);

/**
 * @swagger
 * /admin/banners/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Eliminar banner
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Banner eliminado
 *       404:
 *         description: Banner no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/banners/:id',    deleteBanner);

/**
 * @swagger
 * /admin/announcements:
 *   get:
 *     tags: [Admin]
 *     summary: Listar todos los anuncios (incluye inactivos y vencidos)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista completa de anuncios
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
 *                       title: { type: string }
 *                       body: { type: string, nullable: true }
 *                       imageUrl: { type: string, nullable: true }
 *                       linkUrl: { type: string, nullable: true }
 *                       linkLabel: { type: string, nullable: true }
 *                       targetAudience: { type: string, enum: [all, authenticated, wholesale, retail] }
 *                       active: { type: boolean }
 *                       validFrom: { type: string, format: date-time, nullable: true }
 *                       validUntil: { type: string, format: date-time, nullable: true }
 *                       sortOrder: { type: integer }
 */
router.get('/announcements',           getAllAnnouncements);

/**
 * @swagger
 * /admin/announcements:
 *   post:
 *     tags: [Admin]
 *     summary: Crear anuncio (con imagen opcional)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               body: { type: string }
 *               image: { type: string, format: binary }
 *               linkUrl: { type: string }
 *               linkLabel: { type: string }
 *               targetAudience: { type: string, enum: [all, authenticated, wholesale, retail] }
 *               validFrom: { type: string, format: date-time }
 *               validUntil: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Anuncio creado
 *       400:
 *         description: Título requerido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/announcements',          uploadAnnouncementsMiddleware, createAnnouncement);

/**
 * @swagger
 * /admin/announcements/reorder:
 *   patch:
 *     tags: [Admin]
 *     summary: Reordenar anuncios
 *     security:
 *       - bearerAuth: []
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
 *         description: Anuncios reordenados
 */
router.patch('/announcements/reorder', reorderAnnouncements);

/**
 * @swagger
 * /admin/announcements/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Actualizar anuncio (PATCH parcial)
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
 *               title: { type: string }
 *               body: { type: string, nullable: true }
 *               linkUrl: { type: string, nullable: true }
 *               linkLabel: { type: string, nullable: true }
 *               targetAudience: { type: string, enum: [all, authenticated, wholesale, retail] }
 *               active: { type: boolean }
 *               validFrom: { type: string, format: date-time, nullable: true }
 *               validUntil: { type: string, format: date-time, nullable: true }
 *     responses:
 *       200:
 *         description: Anuncio actualizado
 *       404:
 *         description: Anuncio no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/announcements/:id',     updateAnnouncement);

/**
 * @swagger
 * /admin/announcements/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Eliminar anuncio (y su imagen si es local)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Anuncio eliminado
 *       404:
 *         description: Anuncio no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/announcements/:id',    deleteAnnouncement);

export default router;
