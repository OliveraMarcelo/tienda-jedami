export const FIND_INTENT_BY_ORDER_ID = `
  SELECT id, device_id, order_id, mp_intent_id, status, mp_payment_id, created_at, updated_at
  FROM pos_payment_intents
  WHERE order_id = $1
  ORDER BY created_at DESC
  LIMIT 1
`;
