import { MercadoPagoConfig, Preference, Payment as MpPayment } from 'mercadopago';
import { createHmac } from 'crypto';
import { pool } from '../../config/database.js';
import { ENV } from '../../config/env.js';
import { AppError } from '../../types/app-error.js';
import { logger } from '../../config/logger.js';
import * as paymentsRepository from './payments.repository.js';
import * as ordersRepository from '../orders/orders.repository.js';
import * as customersRepository from '../customers/customers.repository.js';

// ─── MP Client ────────────────────────────────────────────────────────────────

const mpClient = new MercadoPagoConfig({ accessToken: ENV.MP_ACCESS_TOKEN });

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function initiateCheckout(orderId: number, userId: number) {
  const customer = await customersRepository.findByUserId(userId);
  if (!customer) {
    throw new AppError(403, 'Sin perfil de comprador', 'https://jedami.com/errors/no-customer', 'El usuario no tiene perfil de comprador');
  }

  const order = await ordersRepository.findById(orderId);
  if (!order) {
    throw new AppError(404, 'Pedido no encontrado', 'https://jedami.com/errors/order-not-found', `No existe pedido con id ${orderId}`);
  }
  if (order.customer_id !== customer.id) {
    throw new AppError(403, 'Acceso denegado', 'https://jedami.com/errors/forbidden', 'No tenés permiso para acceder a este pedido');
  }
  if (order.status === 'paid') {
    throw new AppError(409, 'Pedido ya pagado', 'https://jedami.com/errors/already-paid', 'Este pedido ya fue pagado');
  }
  if (Number(order.total_amount) <= 0) {
    throw new AppError(422, 'Sin monto', 'https://jedami.com/errors/no-amount', 'El pedido no tiene monto para pagar');
  }

  // Reusar pago pendiente si ya existe (evita duplicados por doble-click o reintentos)
  const existingPayment = await paymentsRepository.findByOrderId(orderId);
  if (existingPayment?.status === 'pending' && existingPayment.mp_preference_id) {
    // Reconstruir la URL de checkout desde la preferencia existente
    const preferenceApi = new Preference(mpClient);
    try {
      const existing = await preferenceApi.get({ preferenceId: existingPayment.mp_preference_id });
      if (existing.init_point) {
        return {
          orderId,
          checkoutUrl: existing.init_point,
          paymentId: existingPayment.id,
          preferenceId: existingPayment.mp_preference_id,
        };
      }
    } catch {
      // Si no se puede recuperar la preferencia (expiró, etc.), crear una nueva
    }
  }

  const preferenceApi = new Preference(mpClient);
  let prefResponse;
  try {
    prefResponse = await preferenceApi.create({
      body: {
        items: [
          {
            id: String(orderId),
            title: `Pedido Jedami #${orderId}`,
            quantity: 1,
            unit_price: Number(order.total_amount),
            currency_id: 'ARS',
          },
        ],
        external_reference: String(orderId),
        back_urls: {
          success: `${ENV.FRONTEND_URL}/pedidos/${orderId}/confirmacion?status=approved`,
          failure: `${ENV.FRONTEND_URL}/pedidos/${orderId}/confirmacion?status=rejected`,
          pending: `${ENV.FRONTEND_URL}/pedidos/${orderId}/confirmacion?status=pending`,
        },
        notification_url: ENV.MP_WEBHOOK_URL || undefined,
      },
    });
  } catch (err: unknown) {
    const mpErr = err as { message?: string; cause?: unknown };
    logger.error({ err }, '[PAYMENTS] Error creando preferencia en Mercado Pago');
    throw new AppError(502, 'Error en Mercado Pago', 'https://jedami.com/errors/mp-error',
      `MP error: ${mpErr.message ?? JSON.stringify(mpErr)}`);
  }

  const payment = await paymentsRepository.create(orderId, prefResponse.id!);

  return {
    orderId,
    checkoutUrl: prefResponse.init_point!,
    paymentId: payment.id,
    preferenceId: prefResponse.id,
  };
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

function verifyWebhookSignature(rawBody: string, signatureHeader: string, requestId: string): boolean {
  if (!ENV.MP_WEBHOOK_SECRET) {
    if (ENV.NODE_ENV === 'production') {
      // En producción, fallar explícitamente si falta el secret — no aceptar webhooks sin verificar
      logger.error('[PAYMENTS] MP_WEBHOOK_SECRET no configurado en producción');
      return false;
    }
    return true; // en dev/test, saltear verificación
  }

  try {
    // Formato: ts=<timestamp>,v1=<hash>
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(',')) {
      const [k, v] = part.split('=');
      parts[k.trim()] = v.trim();
    }
    const { ts, v1 } = parts;
    if (!ts || !v1) return false;

    // MP firma: "id:<data.id>;request-id:<x-request-id>;ts:<ts>"
    // Parseamos el body para obtener data.id
    const body = JSON.parse(rawBody);
    const dataId = body?.data?.id ?? '';
    const signedData = `id:${dataId};request-id:${requestId};ts:${ts}`;

    const expectedHash = createHmac('sha256', ENV.MP_WEBHOOK_SECRET)
      .update(signedData)
      .digest('hex');

    return expectedHash === v1;
  } catch {
    return false;
  }
}

export async function processWebhook(
  rawBody: string,
  signatureHeader: string,
  requestId: string,
) {
  if (!verifyWebhookSignature(rawBody, signatureHeader, requestId)) {
    throw new AppError(401, 'Firma inválida', 'https://jedami.com/errors/invalid-signature', 'La firma del webhook no es válida');
  }

  let body: { action?: string; data?: { id?: string } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { received: true }; // ignorar bodies inválidos
  }

  const { action, data } = body;

  if (action !== 'payment.updated' && action !== 'payment.created') {
    return { received: true }; // evento no relevante
  }

  const mpPaymentId = data?.id;
  if (!mpPaymentId) return { received: true };

  // Consultar estado real del pago a la API de MP
  let mpPaymentData: { status?: string; transaction_amount?: number; external_reference?: string };
  try {
    const mpPaymentApi = new MpPayment(mpClient);
    mpPaymentData = await mpPaymentApi.get({ id: mpPaymentId });
  } catch (err) {
    logger.error({ err, mpPaymentId }, '[PAYMENTS] Error consultando pago en MP');
    return { received: true }; // responder 200 a MP para evitar reintentos
  }

  const { status, transaction_amount, external_reference } = mpPaymentData;
  const orderId = external_reference ? Number(external_reference) : null;

  if (!orderId) {
    logger.warn({ mpPaymentId }, '[PAYMENTS] Webhook sin external_reference');
    return { received: true };
  }

  // Buscar o vincular el pago por preferenceId / orderId
  let payment = await paymentsRepository.findByMpPaymentId(mpPaymentId);
  if (!payment) {
    // Intentar vincular por orderId
    payment = await paymentsRepository.findByOrderId(orderId);
    if (payment && !payment.mp_payment_id) {
      await paymentsRepository.linkMpPaymentId(payment.mp_preference_id!, mpPaymentId);
    }
  }

  if (!payment) {
    logger.warn({ mpPaymentId, orderId }, '[PAYMENTS] No se encontró pago para el webhook');
    return { received: true };
  }

  // Actualizar estado del pago y del pedido
  if (status === 'approved') {
    await paymentsRepository.updateStatus(mpPaymentId, 'approved', transaction_amount);
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);
    logger.info({ orderId, mpPaymentId }, '[PAYMENTS] Pedido marcado como pagado');
  } else if (status === 'rejected') {
    await paymentsRepository.updateStatus(mpPaymentId, 'rejected');
    await pool.query("UPDATE orders SET status = 'rejected' WHERE id = $1", [orderId]);
    logger.info({ orderId, mpPaymentId }, '[PAYMENTS] Pedido marcado como rechazado');
  }

  return { received: true };
}
