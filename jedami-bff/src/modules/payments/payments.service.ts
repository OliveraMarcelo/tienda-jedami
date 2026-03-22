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

  // Leer gateway activo
  const brandingRes = await pool.query(
    `SELECT payment_gateway,
            bank_transfer_cvu, bank_transfer_alias, bank_transfer_holder_name,
            bank_transfer_bank_name, bank_transfer_notes
     FROM branding WHERE id = 1`,
  );
  const branding = brandingRes.rows[0];
  const gateway: 'checkout_pro' | 'checkout_api' | 'bank_transfer' = branding?.payment_gateway ?? 'checkout_pro';

  // Checkout API: no se necesita preferencia en MP.
  // El Brick solo necesita la publicKey y el amount del pedido.
  if (gateway === 'checkout_api') {
    return { type: 'preference' as const, publicKey: ENV.MP_PUBLIC_KEY };
  }

  // Bank Transfer: registrar pago pendiente y devolver datos bancarios
  if (gateway === 'bank_transfer') {
    const existing = await pool.query(
      `SELECT id FROM payments WHERE order_id = $1 AND payment_method = 'bank_transfer' AND status = 'pending'`,
      [orderId],
    );
    if (existing.rowCount === 0) {
      await pool.query(
        `INSERT INTO payments (order_id, status, payment_method) VALUES ($1, 'pending', 'bank_transfer')`,
        [orderId],
      );
    }
    return {
      type:        'bank_transfer' as const,
      bankDetails: {
        cvu:        branding?.bank_transfer_cvu ?? null,
        alias:      branding?.bank_transfer_alias ?? null,
        holderName: branding?.bank_transfer_holder_name ?? null,
        bankName:   branding?.bank_transfer_bank_name ?? null,
        notes:      branding?.bank_transfer_notes ?? null,
        amount:     order.total_amount,
      },
    };
  }

  // Checkout Pro: reusar preferencia pendiente si ya existe
  const existingPayment = await paymentsRepository.findByOrderId(orderId);
  if (existingPayment?.status === 'pending' && existingPayment.mp_preference_id) {
    const preferenceApi = new Preference(mpClient);
    try {
      const existing = await preferenceApi.get({ preferenceId: existingPayment.mp_preference_id });
      if (existing.init_point) {
        return { type: 'redirect' as const, checkoutUrl: existing.init_point };
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

  await paymentsRepository.create(orderId, prefResponse.id!);
  return { type: 'redirect' as const, checkoutUrl: prefResponse.init_point! };
}

// ─── Process Payment (Checkout API) ───────────────────────────────────────────

// Formato nativo del CardPaymentBrick de Mercado Pago
interface ProcessPaymentDTO {
  token: string;
  payment_method_id: string;
  issuer_id?: string | null;
  installments: number;
  transaction_amount?: number;
  payer: {
    email: string;
    identification: {
      type: string;
      number: string;
    };
  };
}

export async function processPayment(orderId: number, userId: number, dto: ProcessPaymentDTO) {
  // Verificar que el gateway activo sea checkout_api
  const brandingRes = await pool.query('SELECT payment_gateway FROM branding WHERE id = 1');
  const gateway = brandingRes.rows[0]?.payment_gateway ?? 'checkout_pro';
  if (gateway !== 'checkout_api') {
    throw new AppError(400, 'Gateway incorrecto', 'https://jedami.com/errors/wrong-gateway', 'El gateway activo no es checkout_api');
  }

  // Verificar ownership del pedido
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

  // Crear pago en MP con el token de la tarjeta
  const paymentApi = new MpPayment(mpClient);
  let mpResult: { status?: string; status_detail?: string; id?: number };
  try {
    mpResult = await paymentApi.create({
      body: {
        transaction_amount: Number(order.total_amount),
        token: dto.token,
        description: `Pedido Jedami #${orderId}`,
        payment_method_id: dto.payment_method_id,
        issuer_id: dto.issuer_id ? Number(dto.issuer_id) : undefined,
        installments: Number(dto.installments),
        external_reference: String(orderId),
        payer: {
          email: dto.payer.email,
          identification: {
            type: dto.payer.identification.type,
            number: dto.payer.identification.number,
          },
        },
      },
    });
  } catch (err: unknown) {
    const mpErr = err as { message?: string };
    logger.error({ err }, '[PAYMENTS] Error procesando pago Checkout API');
    throw new AppError(502, 'Error en Mercado Pago', 'https://jedami.com/errors/mp-error', `MP error: ${mpErr.message ?? JSON.stringify(mpErr)}`);
  }

  const { status, status_detail } = mpResult;

  // Vincular o crear registro de pago
  const mpPaymentId = String(mpResult.id ?? '');
  const existingPayment = await paymentsRepository.findByOrderId(orderId);
  if (existingPayment) {
    await pool.query(
      "UPDATE payments SET mp_payment_id = $2, status = $3 WHERE id = $1",
      [existingPayment.id, mpPaymentId, status === 'approved' ? 'approved' : 'pending'],
    );
  } else {
    await pool.query(
      "INSERT INTO payments (order_id, mp_payment_id, status) VALUES ($1, $2, $3)",
      [orderId, mpPaymentId, status === 'approved' ? 'approved' : 'pending'],
    );
  }

  // Actualizar estado del pedido
  if (status === 'approved') {
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1 AND status != 'paid'", [orderId]);
    logger.info({ orderId, mpPaymentId }, '[PAYMENTS] Pago aprobado (Checkout API)');
  } else if (status === 'rejected') {
    await pool.query("UPDATE orders SET status = 'rejected' WHERE id = $1 AND status != 'paid'", [orderId]);
    logger.info({ orderId, status_detail }, '[PAYMENTS] Pago rechazado (Checkout API)');
  } else {
    logger.info({ orderId, status, status_detail }, '[PAYMENTS] Pago en revisión (Checkout API)');
  }

  // Normalizar in_process → pending (contrato del AC)
  const normalizedStatus = status === 'in_process' ? 'pending' : (status ?? 'pending');
  return { status: normalizedStatus, statusDetail: status_detail };
}

// ─── Retry Payment ────────────────────────────────────────────────────────────

export async function retryPayment(orderId: number, userId: number, isAdmin: boolean) {
  const order = await ordersRepository.findById(orderId);
  if (!order) {
    throw new AppError(404, 'Pedido no encontrado', 'https://jedami.com/errors/order-not-found', `No existe pedido con id ${orderId}`);
  }

  if (!isAdmin) {
    const customer = await customersRepository.findByUserId(userId);
    if (!customer || order.customer_id !== customer.id) {
      throw new AppError(403, 'Acceso denegado', 'https://jedami.com/errors/forbidden', 'No tenés permiso para acceder a este pedido');
    }
  }

  if (!['pending', 'rejected'].includes(order.status)) {
    throw new AppError(422, 'Estado inválido', 'https://jedami.com/errors/invalid-status', `No se puede reintentar: el pedido está en estado ${order.status}`);
  }

  if (Number(order.total_amount) <= 0) {
    throw new AppError(422, 'Sin monto', 'https://jedami.com/errors/no-amount', 'El pedido no tiene monto para pagar');
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
    const mpErr = err as { message?: string };
    logger.error({ err }, '[PAYMENTS] Error creando preferencia en reintento');
    throw new AppError(502, 'Error en Mercado Pago', 'https://jedami.com/errors/mp-error', `MP error: ${mpErr.message ?? JSON.stringify(mpErr)}`);
  }

  // Actualizar preferencia en el pago existente (o crear uno nuevo si no existe)
  const existingPayment = await paymentsRepository.findByOrderId(orderId);
  if (existingPayment) {
    await pool.query(
      "UPDATE payments SET mp_preference_id = $2, mp_payment_id = NULL, status = 'pending' WHERE id = $1",
      [existingPayment.id, prefResponse.id],
    );
  } else {
    await paymentsRepository.create(orderId, prefResponse.id!);
  }

  return { checkoutUrl: prefResponse.init_point! };
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

  // Idempotencia: si el pago ya fue procesado con estado final, ignorar
  if (payment.status === 'approved' || payment.status === 'rejected') {
    logger.info({ orderId, mpPaymentId, status: payment.status }, '[PAYMENTS] Webhook duplicado ignorado');
    return { received: true };
  }

  // Actualizar estado del pago y del pedido (idempotente: no sobrescribir estados finales)
  if (status === 'approved') {
    await paymentsRepository.updateStatus(mpPaymentId, 'approved', transaction_amount);
    await pool.query("UPDATE orders SET status = 'paid' WHERE id = $1 AND status != 'paid'", [orderId]);
    logger.info({ orderId, mpPaymentId }, '[PAYMENTS] Pedido marcado como pagado');
  } else if (status === 'rejected') {
    await paymentsRepository.updateStatus(mpPaymentId, 'rejected');
    await pool.query("UPDATE orders SET status = 'rejected' WHERE id = $1 AND status != 'paid'", [orderId]);
    logger.info({ orderId, mpPaymentId }, '[PAYMENTS] Pedido marcado como rechazado');
  }

  return { received: true };
}
