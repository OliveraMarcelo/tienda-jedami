export const UPDATE_CURVA_RULE = `
  UPDATE curva_discount_rules
  SET
    min_curves   = COALESCE($3, min_curves),
    discount_pct = COALESCE($4, discount_pct),
    active       = COALESCE($5, active)
  WHERE id = $1 AND product_id = $2
  RETURNING id, product_id, min_curves, discount_pct, active, created_at
`;
