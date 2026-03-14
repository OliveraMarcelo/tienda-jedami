export const CREATE_ORDER = `
  INSERT INTO orders (customer_id, purchase_type, status, total_amount)
  VALUES ($1, $2, 'pending', 0)
  RETURNING id, customer_id, purchase_type, status, total_amount, created_at
`;
