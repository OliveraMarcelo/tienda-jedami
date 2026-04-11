export const FIND_ACTIVE_GATEWAYS_BY_CUSTOMER_TYPE = `
  SELECT gateway
  FROM payment_gateway_rules
  WHERE customer_type = $1
    AND active = TRUE
  ORDER BY id
`;
