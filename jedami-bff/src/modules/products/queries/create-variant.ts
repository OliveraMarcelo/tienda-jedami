export const CREATE_VARIANT = `
  INSERT INTO variants (product_id, size_id, color_id)
  VALUES ($1, $2, $3)
  RETURNING id, product_id, size_id, color_id
`;
