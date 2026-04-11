import { pool } from '../../config/database.js';
import { PosDevice, PosPaymentIntent, PosIntentStatus } from './pos.entity.js';
import { FIND_DEVICES } from './queries/find-devices.js';
import { FIND_DEVICE_BY_ID } from './queries/find-device-by-id.js';
import { UPSERT_DEVICE } from './queries/upsert-device.js';
import { FIND_INTENT_BY_ORDER_ID } from './queries/find-intent-by-order-id.js';
import { FIND_INTENT_BY_MP_ID } from './queries/find-intent-by-mp-id.js';
import { UPSERT_INTENT } from './queries/upsert-intent.js';

export async function findDevices(): Promise<PosDevice[]> {
  const result = await pool.query(FIND_DEVICES);
  return result.rows;
}

export async function findDeviceById(id: number): Promise<PosDevice | null> {
  const result = await pool.query(FIND_DEVICE_BY_ID, [id]);
  return result.rows[0] ?? null;
}

export async function upsertDevice(
  mpDeviceId: string,
  name: string,
  operatingMode: 'PDV' | 'STANDALONE',
): Promise<PosDevice> {
  const result = await pool.query(UPSERT_DEVICE, [mpDeviceId, name, operatingMode]);
  return result.rows[0];
}

export async function updateDevice(id: number, active: boolean): Promise<PosDevice | null> {
  const result = await pool.query(
    'UPDATE pos_devices SET active = $2 WHERE id = $1 RETURNING id, mp_device_id, name, operating_mode, active, created_at',
    [id, active],
  );
  return result.rows[0] ?? null;
}

export async function findActiveDevice(): Promise<PosDevice | null> {
  const result = await pool.query(
    'SELECT id, mp_device_id, name, operating_mode, active, created_at FROM pos_devices WHERE active = TRUE ORDER BY id ASC LIMIT 1',
  );
  return result.rows[0] ?? null;
}

export async function findIntentByOrderId(orderId: number): Promise<PosPaymentIntent | null> {
  const result = await pool.query(FIND_INTENT_BY_ORDER_ID, [orderId]);
  return result.rows[0] ?? null;
}

export async function findIntentByMpId(mpIntentId: string): Promise<PosPaymentIntent | null> {
  const result = await pool.query(FIND_INTENT_BY_MP_ID, [mpIntentId]);
  return result.rows[0] ?? null;
}

export async function upsertIntent(
  deviceId: number,
  orderId: number,
  mpIntentId: string,
  status: PosIntentStatus,
): Promise<PosPaymentIntent> {
  const result = await pool.query(UPSERT_INTENT, [deviceId, orderId, mpIntentId, status]);
  return result.rows[0];
}

export async function updateIntentStatus(
  mpIntentId: string,
  status: PosIntentStatus,
  mpPaymentId?: string,
): Promise<void> {
  await pool.query(
    `UPDATE pos_payment_intents
     SET status = $2, mp_payment_id = COALESCE($3, mp_payment_id), updated_at = NOW()
     WHERE mp_intent_id = $1`,
    [mpIntentId, status, mpPaymentId ?? null],
  );
}
