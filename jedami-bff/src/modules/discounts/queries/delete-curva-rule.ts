export const DELETE_CURVA_RULE = `
  DELETE FROM curva_discount_rules
  WHERE id = $1 AND product_id = $2
`;
