export const CREATE_VARIANT = `
  INSERT INTO variants (product_id, size, color, retail_price, wholesale_price)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id, product_id, size, color, retail_price, wholesale_price
`;
