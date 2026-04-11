export const UPDATE_PRODUCT_MIN_QUANTITY = `
  UPDATE products
  SET min_quantity_purchase = $1
  WHERE id = $2
  RETURNING id, min_quantity_purchase
`;
