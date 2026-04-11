export const UPSERT_INTENT = `
  INSERT INTO pos_payment_intents (device_id, order_id, mp_intent_id, status)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (mp_intent_id) DO UPDATE
    SET status      = EXCLUDED.status,
        updated_at  = NOW()
  RETURNING id, device_id, order_id, mp_intent_id, status, mp_payment_id, created_at, updated_at
`;
