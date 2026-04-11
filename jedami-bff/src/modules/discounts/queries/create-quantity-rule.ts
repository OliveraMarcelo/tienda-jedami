export const CREATE_QUANTITY_RULE = `
  INSERT INTO quantity_discount_rules (product_id, min_quantity, discount_pct)
  VALUES ($1, $2, $3)
  RETURNING id, product_id, min_quantity, discount_pct, active, created_at
`;
