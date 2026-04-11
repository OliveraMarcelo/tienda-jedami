export const FIND_INTENT_BY_MP_ID = `
  SELECT id, device_id, order_id, mp_intent_id, status, mp_payment_id, created_at, updated_at
  FROM pos_payment_intents
  WHERE mp_intent_id = $1
`;
