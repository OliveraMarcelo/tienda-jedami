export const FIND_ORDERS_BY_CUSTOMER = `
  SELECT id, customer_id, purchase_type, status, total_amount, notes, created_at
  FROM orders
  WHERE customer_id = $1
  ORDER BY created_at DESC
`;
