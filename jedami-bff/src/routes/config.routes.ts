import { Router } from 'express';
import {
  getConfig,
  getBranding,
  updateBranding,
  uploadBrandingLogoHandler,
  listPurchaseTypes,
  createPurchaseType,
  updatePurchaseType,
  listCustomerTypes,
  createCustomerType,
  updateCustomerType,
  updatePaymentGateway,
  getPaymentGatewayRules,
  updatePaymentGatewayRule,
} from '../modules/config/config.controller.js';
import { getBanners } from '../modules/admin/banners.controller.js';
import { getAnnouncements } from '../modules/admin/announcements.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { ROLES } from '../lib/constants.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Config
 *   description: Configuración del sistema, branding y banners públicos
 */

/**
 * @swagger
 * /config:
 *   get:
 *     tags: [Config]
 *     summary: Obtener configuración global del sistema
 *     description: Devuelve roles, modos de precio, tipos de compra/cliente y gateway de pago activo. Respuesta cacheada 5 minutos.
 *     responses:
 *       200:
 *         description: Configuración del sistema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Config' }
 */
router.get('/',        getConfig);

/**
 * @swagger
 * /config/branding:
 *   get:
 *     tags: [Config]
 *     summary: Obtener branding de la tienda
 *     responses:
 *       200:
 *         description: Datos de branding
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Branding' }
 */
router.get('/branding', getBranding);

/**
 * @swagger
 * /config/announcements:
 *   get:
 *     tags: [Config]
 *     summary: Listar anuncios vigentes para una audiencia
 *     parameters:
 *       - in: query
 *         name: audience
 *         schema:
 *           type: string
 *           enum: [all, wholesale, retail]
 *           default: all
 *         description: Audiencia del usuario. Los visitantes envían 'all', los autenticados envían su rol.
 *     responses:
 *       200:
 *         description: Lista de anuncios vigentes
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
 *                       sortOrder: { type: integer }
 */
router.get('/announcements', getAnnouncements);

/**
 * @swagger
 * /config/banners:
 *   get:
 *     tags: [Config]
 *     summary: Listar banners activos del catálogo
 *     responses:
 *       200:
 *         description: Lista de banners activos ordenados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Banner' }
 */
router.get('/banners',  getBanners);

/**
 * @swagger
 * /config/purchase-types:
 *   get:
 *     tags: [Config]
 *     summary: Listar tipos de compra (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tipos de compra (incluye inactivos)
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
 *                       code: { type: string }
 *                       label: { type: string }
 *                       active: { type: boolean }
 */
router.get('/purchase-types',       authMiddleware, requireRole([ROLES.ADMIN]), listPurchaseTypes);

/**
 * @swagger
 * /config/purchase-types:
 *   post:
 *     tags: [Config]
 *     summary: Crear tipo de compra (solo admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *     responses:
 *       201:
 *         description: Tipo de compra creado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/purchase-types',      authMiddleware, requireRole([ROLES.ADMIN]), createPurchaseType);

/**
 * @swagger
 * /config/purchase-types/{id}:
 *   patch:
 *     tags: [Config]
 *     summary: Actualizar tipo de compra (solo admin)
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
 *               label: { type: string }
 *               active: { type: boolean }
 *     responses:
 *       200:
 *         description: Tipo de compra actualizado
 *       404:
 *         description: No encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/purchase-types/:id', authMiddleware, requireRole([ROLES.ADMIN]), updatePurchaseType);

/**
 * @swagger
 * /config/customer-types:
 *   get:
 *     tags: [Config]
 *     summary: Listar tipos de cliente (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tipos de cliente (incluye inactivos)
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
 *                       code: { type: string }
 *                       label: { type: string }
 *                       active: { type: boolean }
 */
router.get('/customer-types',       authMiddleware, requireRole([ROLES.ADMIN]), listCustomerTypes);

/**
 * @swagger
 * /config/customer-types:
 *   post:
 *     tags: [Config]
 *     summary: Crear tipo de cliente (solo admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, label]
 *             properties:
 *               code: { type: string }
 *               label: { type: string }
 *     responses:
 *       201:
 *         description: Tipo de cliente creado
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/customer-types',      authMiddleware, requireRole([ROLES.ADMIN]), createCustomerType);

/**
 * @swagger
 * /config/customer-types/{id}:
 *   patch:
 *     tags: [Config]
 *     summary: Actualizar tipo de cliente (solo admin)
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
 *               label: { type: string }
 *               active: { type: boolean }
 *     responses:
 *       200:
 *         description: Tipo de cliente actualizado
 *       404:
 *         description: No encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/customer-types/:id', authMiddleware, requireRole([ROLES.ADMIN]), updateCustomerType);

/**
 * @swagger
 * /config/payment-gateway:
 *   patch:
 *     tags: [Config]
 *     summary: Cambiar gateway de pago activo (solo admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gateway]
 *             properties:
 *               gateway:
 *                 type: string
 *                 enum: [checkout_pro, checkout_api]
 *     responses:
 *       200:
 *         description: Gateway actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentGateway: { type: string }
 *       400:
 *         description: Valor inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/payment-gateway',         authMiddleware, requireRole([ROLES.ADMIN]), updatePaymentGateway);

/**
 * @swagger
 * /config/payment-gateways:
 *   get:
 *     tags: [Config]
 *     summary: Listar reglas de gateway de pago por tipo de cliente (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reglas agrupadas por customer_type
 */
router.get('/payment-gateways',          authMiddleware, requireRole([ROLES.ADMIN]), getPaymentGatewayRules);

/**
 * @swagger
 * /config/payment-gateways:
 *   patch:
 *     tags: [Config]
 *     summary: Habilitar o deshabilitar un gateway para un tipo de cliente (solo admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_type, gateway, active]
 *             properties:
 *               customer_type: { type: string, enum: [retail, wholesale] }
 *               gateway: { type: string, enum: [checkout_pro, checkout_api, bank_transfer, mp_point] }
 *               active: { type: boolean }
 *     responses:
 *       200:
 *         description: Regla actualizada
 *       400:
 *         description: Valores inválidos
 */
router.patch('/payment-gateways',        authMiddleware, requireRole([ROLES.ADMIN]), updatePaymentGatewayRule);

/**
 * @swagger
 * /config/branding:
 *   put:
 *     tags: [Config]
 *     summary: Actualizar branding de la tienda (solo admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeName: { type: string, nullable: true }
 *               primaryColor: { type: string, nullable: true, example: '#E91E8C' }
 *               secondaryColor: { type: string, nullable: true }
 *               logoUrl: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Branding actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Branding' }
 */
router.put('/branding',                  authMiddleware, requireRole([ROLES.ADMIN]), updateBranding);

/**
 * @swagger
 * /config/branding/logo:
 *   post:
 *     tags: [Config]
 *     summary: Subir logo de la tienda (solo admin)
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
 *     responses:
 *       200:
 *         description: Logo subido y branding actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Branding' }
 *       400:
 *         description: Imagen no enviada o inválida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/branding/logo',            authMiddleware, requireRole([ROLES.ADMIN]), uploadBrandingLogoHandler);

export default router;
