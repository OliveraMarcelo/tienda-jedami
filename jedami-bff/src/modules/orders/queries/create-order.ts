export const CREATE_ORDER = `
  INSERT INTO orders (customer_id, purchase_type, status, total_amount, notes)
  VALUES ($1, $2, 'pending', 0, $3)
  RETURNING id, customer_id, purchase_type, status, total_amount, notes, created_at
`;
