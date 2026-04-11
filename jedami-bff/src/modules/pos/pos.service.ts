import { ENV } from '../../config/env.js';
import { AppError } from '../../types/app-error.js';
import { logger } from '../../config/logger.js';
import { cacheDel } from '../../config/redis.js';
import { pool } from '../../config/database.js';
import * as posRepository from './pos.repository.js';
import * as ordersRepository from '../orders/orders.repository.js';
import { PosDevice, PosPaymentIntent, PosIntentStatus } from './pos.entity.js';

const ACTIVE_STATUSES = new Set(['open', 'on_terminal', 'processing']);

const CONFIG_CACHE_KEY = 'config:all';

/**
 * Interpreta errores HTTP de la API de MP Point y lanza un AppError con
 * mensaje claro en español. El error 106 de MP indica credenciales de prueba
 * (TEST-...) — la API Point solo funciona con credenciales de producción (APP_USR-...).
 */
function throwMpPointError(status: number, body: string, context: string): never {
  let parsed: { error?: string | number; message?: string } = {};
  try { parsed = JSON.parse(body); } catch { /* body no es JSON */ }

  if (status === 401 && String(parsed.error) === '106') {
    throw new AppError(
      422,
      'Credenciales de MP no autorizadas para Point',
      'https://jedami.com/errors/mp-credentials',
      'La API de MercadoPago Point requiere credenciales de PRODUCCIÓN (APP_USR-...). ' +
      'Las credenciales de prueba (TEST-...) no funcionan con el hardware Point. ' +
      'Verificá que MP_ACCESS_TOKEN en el .env sea un token de producción y que la app de MP tenga habilitada la integración Point.',
    );
  }

  throw new AppError(502, `Error al ${context}`, 'https://jedami.com/errors/mp-error',
    `MP respondió ${status}: ${body}`);
}

interface MpDevice {
  id: string;
  operating_mode?: string;
  store_name?: string;
  pos_name?: string;
}

export async function syncDevices(): Promise<PosDevice[]> {
  const response = await fetch(
    'https://api.mercadopago.com/point/integration-api/devices',
    {
      headers: {
        Authorization: `Bearer ${ENV.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error({ status: response.status, body }, '[POS] Error sync devices desde MP');
    throwMpPointError(response.status, body, 'sincronizar dispositivos');
  }

  const data = (await response.json()) as { devices?: MpDevice[] };
  const devices: MpDevice[] = data.devices ?? [];

  const synced: PosDevice[] = [];
  for (const d of devices) {
    const name = d.pos_name ?? d.store_name ?? d.id;
    const mode = (d.operating_mode ?? 'PDV').toUpperCase() === 'STANDALONE' ? 'STANDALONE' : 'PDV';
    const device = await posRepository.upsertDevice(d.id, name, mode);
    synced.push(device);
    logger.info({ mpDeviceId: d.id, name }, '[POS] Device sincronizado');
  }

  // Invalidar cache de config para que GET /config refleje los nuevos devices
  await cacheDel(CONFIG_CACHE_KEY);

  return synced;
}

export async function listDevices(): Promise<PosDevice[]> {
  return posRepository.findDevices();
}

export async function updateDevice(id: number, active: boolean): Promise<PosDevice> {
  const device = await posRepository.updateDevice(id, active);
  if (!device) {
    throw new AppError(404, 'Dispositivo no encontrado', 'https://jedami.com/errors/not-found',
      `No existe dispositivo con id ${id}`);
  }
  await cacheDel(CONFIG_CACHE_KEY);
  logger.info({ deviceId: id, active }, '[POS] Device actualizado');
  return device;
}

export async function getActiveDevice(): Promise<PosDevice | null> {
  return posRepository.findActiveDevice();
}

// ─── Intent lifecycle ─────────────────────────────────────────────────────────

export async function createIntent(orderId: number): Promise<{ intentId: string; deviceName: string; status: string }> {
  const order = await ordersRepository.findById(orderId);
  if (!order) {
    throw new AppError(404, 'Pedido no encontrado', 'https://jedami.com/errors/not-found', `No existe pedido con id ${orderId}`);
  }
  if (order.status === 'paid') {
    throw new AppError(409, 'Pedido ya pagado', 'https://jedami.com/errors/already-paid', 'Este pedido ya fue pagado');
  }
  if (Number(order.total_amount) <= 0) {
    throw new AppError(422, 'Sin monto', 'https://jedami.com/errors/no-amount', 'El pedido no tiene monto para pagar');
  }

  const device = await posRepository.findActiveDevice();
  if (!device) {
    throw new AppError(422, 'No hay dispositivo Point activo configurado', 'https://jedami.com/errors/no-device',
      'Sincronice y active un dispositivo Point desde la configuración');
  }

  const existing = await posRepository.findIntentByOrderId(orderId);
  if (existing && ACTIVE_STATUSES.has(existing.status)) {
    throw new AppError(409, 'Ya hay un cobro en progreso para este pedido', 'https://jedami.com/errors/intent-active',
      `Intent ${existing.mp_intent_id} en estado ${existing.status}`);
  }

  const amountCents = Math.round(Number(order.total_amount) * 100);
  // Clave estable por ventana de 1 minuto — idempotente en reintentos de red, única entre intentos distintos
  const idempotencyKey = `jedami-order-${orderId}-${Math.floor(Date.now() / 60000)}`;

  const mpResponse = await fetch(
    `https://api.mercadopago.com/point/integration-api/devices/${device.mp_device_id}/payment-intents`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ENV.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount: amountCents,
        description: `Pedido Jedami #${orderId}`,
        payment: { installments: 1, type: 'credit_card' },
        additional_info: {
          external_reference: String(orderId),
          print_on_terminal: true,
        },
      }),
    },
  );

  if (!mpResponse.ok) {
    const body = await mpResponse.text().catch(() => '');
    logger.error({ orderId, status: mpResponse.status, body }, '[POS] Error creando intent en MP');
    throwMpPointError(mpResponse.status, body, 'comunicarse con el dispositivo');
  }

  const mpData = (await mpResponse.json()) as { id: string };
  const mpIntentId = mpData.id;

  await posRepository.upsertIntent(device.id, orderId, mpIntentId, 'open');

  // Crear registro de pago si no existe
  const existingPayment = await pool.query(
    'SELECT id FROM payments WHERE order_id = $1 AND payment_method = $2',
    [orderId, 'mp_point'],
  );
  if (!existingPayment.rowCount) {
    await pool.query(
      "INSERT INTO payments (order_id, payment_method, status) VALUES ($1, 'mp_point', 'pending')",
      [orderId],
    );
  }

  logger.info({ orderId, mpIntentId, deviceId: device.id }, '[POS] Intent creado');
  return { intentId: mpIntentId, deviceName: device.name, status: 'open' };
}

export async function getIntent(orderId: number): Promise<{ intent: PosPaymentIntent; deviceName: string }> {
  const intent = await posRepository.findIntentByOrderId(orderId);
  if (!intent) {
    throw new AppError(404, 'No hay intent para este pedido', 'https://jedami.com/errors/not-found',
      `No existe payment intent para el pedido ${orderId}`);
  }
  const device = await posRepository.findDeviceById(intent.device_id);
  return { intent, deviceName: device?.name ?? '' };
}

export async function confirmPointPayment(
  orderId: number,
  mpPaymentId?: string,
): Promise<{ orderId: number; status: string }> {
  const order = await ordersRepository.findById(orderId);
  if (!order) {
    throw new AppError(404, 'Pedido no encontrado', 'https://jedami.com/errors/not-found', `No existe pedido con id ${orderId}`);
  }
  if (order.status === 'paid') {
    throw new AppError(409, 'Pedido ya pagado', 'https://jedami.com/errors/already-paid', 'Este pedido ya fue pagado');
  }

  if (mpPaymentId) {
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
      { headers: { Authorization: `Bearer ${ENV.MP_ACCESS_TOKEN}` } },
    );

    if (!mpResponse.ok) {
      const body = await mpResponse.text().catch(() => '');
      logger.warn({ mpPaymentId, status: mpResponse.status, body }, '[POS] Error verificando pago en MP');
      throw new AppError(422, 'El pago no está aprobado en Mercado Pago', 'https://jedami.com/errors/mp-not-approved',
        `MP respondió ${mpResponse.status}: ${body}`);
    }

    const mpData = (await mpResponse.json()) as { status?: string };
    if (mpData.status !== 'approved') {
      throw new AppError(422, 'El pago no está aprobado en Mercado Pago', 'https://jedami.com/errors/mp-not-approved',
        `Estado del pago en MP: ${mpData.status ?? 'desconocido'}`);
    }
  }

  // Transacción atómica: payment + order deben actualizarse juntos
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingPayment = await client.query(
      "SELECT id FROM payments WHERE order_id = $1 AND payment_method = 'mp_point'",
      [orderId],
    );
    if (existingPayment.rowCount) {
      await client.query(
        `UPDATE payments SET status = 'approved', paid_at = NOW(), mp_payment_id = COALESCE($2, mp_payment_id)
         WHERE order_id = $1 AND payment_method = 'mp_point'`,
        [orderId, mpPaymentId ?? null],
      );
    } else {
      await client.query(
        `INSERT INTO payments (order_id, payment_method, status, paid_at, mp_payment_id)
         VALUES ($1, 'mp_point', 'approved', NOW(), $2)`,
        [orderId, mpPaymentId ?? null],
      );
    }
    await client.query(
      "UPDATE orders SET status = 'paid' WHERE id = $1 AND status != 'paid'",
      [orderId],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Marcar intent como processed si existe uno activo (best-effort, fuera de la transacción crítica)
  const intent = await posRepository.findIntentByOrderId(orderId);
  if (intent && ACTIVE_STATUSES.has(intent.status)) {
    await posRepository.updateIntentStatus(intent.mp_intent_id, 'processed');
  }

  logger.info({ orderId, mpPaymentId }, '[POS] Pago confirmado manualmente');
  return { orderId, status: 'paid' };
}

export async function processPointWebhook(mpIntentId: string): Promise<void> {
  if (!mpIntentId) {
    logger.warn('[POS] Webhook Point sin intentId — ignorado');
    return;
  }

  const intent = await posRepository.findIntentByMpId(mpIntentId);
  if (!intent) {
    logger.warn({ mpIntentId }, '[POS] Webhook Point: intent no encontrado en DB');
    return;
  }

  // Idempotencia: si el payment ya está en estado terminal, no re-procesar
  const existingPayment = await pool.query(
    "SELECT id, status FROM payments WHERE order_id = $1 AND payment_method = 'mp_point'",
    [intent.order_id],
  );
  const paymentStatus = existingPayment.rows[0]?.status as string | undefined;
  if (paymentStatus === 'approved' || paymentStatus === 'rejected') {
    logger.info({ mpIntentId, paymentStatus }, '[POS] Webhook Point duplicado — ignorado');
    return;
  }

  // Consultar estado real del intent en MP
  const mpResponse = await fetch(
    `https://api.mercadopago.com/point/integration-api/payment-intents/${mpIntentId}`,
    { headers: { Authorization: `Bearer ${ENV.MP_ACCESS_TOKEN}` } },
  );

  if (!mpResponse.ok) {
    const body = await mpResponse.text().catch(() => '');
    logger.error({ mpIntentId, status: mpResponse.status, body }, '[POS] Error consultando intent en MP');
    return; // responder 200 a MP para no provocar reintentos
  }

  const mpData = (await mpResponse.json()) as {
    status?: string;
    payment?: { id?: number; type?: string };
  };

  const mpStatus = mpData.status;
  const mpPaymentId = mpData.payment?.id ? String(mpData.payment.id) : null;

  // Actualizar status del intent en DB
  // MP usa 'finished' para pago aprobado; el DB usa 'processed' (no incluye 'finished' en el CHECK)
  const localIntentStatus: PosIntentStatus = mpStatus === 'finished'
    ? 'processed'
    : ((mpStatus as PosIntentStatus) ?? intent.status);
  await posRepository.updateIntentStatus(mpIntentId, localIntentStatus);

  if (mpStatus === 'finished' && mpPaymentId) {
    // Pago aprobado
    await pool.query(
      `UPDATE payments SET status = 'approved', paid_at = NOW(), mp_payment_id = $2
       WHERE order_id = $1 AND payment_method = 'mp_point'`,
      [intent.order_id, mpPaymentId],
    );
    await pool.query(
      "UPDATE orders SET status = 'paid' WHERE id = $1 AND status != 'paid'",
      [intent.order_id],
    );
    logger.info({ mpIntentId, mpPaymentId, orderId: intent.order_id }, '[POS] Pedido pagado vía Point');
  } else if (mpStatus === 'abandoned' || mpStatus === 'error') {
    // Pago rechazado
    await pool.query(
      "UPDATE payments SET status = 'rejected' WHERE order_id = $1 AND payment_method = 'mp_point'",
      [intent.order_id],
    );
    logger.info({ mpIntentId, mpStatus, orderId: intent.order_id }, '[POS] Pago Point rechazado');
  }
}

export async function cancelIntent(orderId: number): Promise<void> {
  const intent = await posRepository.findIntentByOrderId(orderId);
  if (!intent || !ACTIVE_STATUSES.has(intent.status)) {
    throw new AppError(404, 'No hay intent activo para este pedido', 'https://jedami.com/errors/not-found',
      `No existe intent activo para el pedido ${orderId}`);
  }

  const device = await posRepository.findDeviceById(intent.device_id);
  if (device) {
    const mpResponse = await fetch(
      `https://api.mercadopago.com/point/integration-api/devices/${device.mp_device_id}/payment-intents`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ENV.MP_ACCESS_TOKEN}` },
      },
    );
    if (!mpResponse.ok) {
      logger.warn({ orderId, status: mpResponse.status }, '[POS] MP no pudo cancelar intent — marcando cancelled localmente');
    }
  }

  await posRepository.updateIntentStatus(intent.mp_intent_id, 'cancelled');
  logger.info({ orderId, mpIntentId: intent.mp_intent_id }, '[POS] Intent cancelado');
}
