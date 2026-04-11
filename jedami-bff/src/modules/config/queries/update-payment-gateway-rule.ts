export const UPSERT_PAYMENT_GATEWAY_RULE = `
  INSERT INTO payment_gateway_rules (customer_type, gateway, active)
  VALUES ($1, $2, $3)
  ON CONFLICT (customer_type, gateway)
  DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
  RETURNING id, customer_type, gateway, active, updated_at
`;
