import { pool } from '../../config/database.js';
import { Payment } from './payments.entity.js';

export const create = async (orderId: number, mpPreferenceId: string): Promise<Payment> => {
  const result = await pool.query(
    `INSERT INTO payments (order_id, mp_preference_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [orderId, mpPreferenceId],
  );
  return result.rows[0];
};

export const findByMpPaymentId = async (mpPaymentId: string): Promise<Payment | null> => {
  const result = await pool.query(
    'SELECT * FROM payments WHERE mp_payment_id = $1',
    [mpPaymentId],
  );
  return result.rows[0] ?? null;
};

export const findByOrderId = async (orderId: number): Promise<Payment | null> => {
  const result = await pool.query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
    [orderId],
  );
  return result.rows[0] ?? null;
};

export const updateApproved = async (mpPaymentId: string, amount: number): Promise<void> => {
  await pool.query(
    `UPDATE payments SET status = 'approved', mp_payment_id = $1, amount = $2, paid_at = NOW()
     WHERE mp_payment_id = $1`,
    [mpPaymentId, amount],
  );
};

export const updateStatus = async (mpPaymentId: string, status: 'approved' | 'rejected', amount?: number): Promise<void> => {
  await pool.query(
    `UPDATE payments
     SET status = $2, amount = $3, paid_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE NULL END
     WHERE mp_payment_id = $1`,
    [mpPaymentId, status, amount ?? null],
  );
};

export const linkMpPaymentId = async (preferenceId: string, mpPaymentId: string): Promise<void> => {
  await pool.query(
    'UPDATE payments SET mp_payment_id = $2 WHERE mp_preference_id = $1 AND mp_payment_id IS NULL',
    [preferenceId, mpPaymentId],
  );
};
