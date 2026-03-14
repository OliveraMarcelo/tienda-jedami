export const CREATE_VARIANT = `
  INSERT INTO variants (product_id, size, color, retail_price)
  VALUES ($1, $2, $3, $4)
  RETURNING id, product_id, size, color, retail_price
`;
