export const UPDATE_PRODUCT = `
  UPDATE products
  SET name = COALESCE($2, name),
      description = COALESCE($3, description)
  WHERE id = $1
  RETURNING id, name, description
`;
