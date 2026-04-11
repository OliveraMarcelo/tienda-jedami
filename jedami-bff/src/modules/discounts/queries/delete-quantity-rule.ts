export const DELETE_QUANTITY_RULE = `
  DELETE FROM quantity_discount_rules
  WHERE id = $1 AND product_id = $2
`;
