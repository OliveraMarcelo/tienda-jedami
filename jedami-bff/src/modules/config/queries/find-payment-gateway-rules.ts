export const FIND_PAYMENT_GATEWAY_RULES = `
  SELECT id, customer_type, gateway, active, updated_at
  FROM payment_gateway_rules
  ORDER BY customer_type, id
`;
