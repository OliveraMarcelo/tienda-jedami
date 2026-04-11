export const UPDATE_QUANTITY_RULE = `
  UPDATE quantity_discount_rules
  SET
    min_quantity = COALESCE($3, min_quantity),
    discount_pct = COALESCE($4, discount_pct),
    active       = COALESCE($5, active)
  WHERE id = $1 AND product_id = $2
  RETURNING id, product_id, min_quantity, discount_pct, active, created_at
`;
