export const CREATE_PRODUCT = `
  INSERT INTO products (name, description, category_id)
  VALUES ($1, $2, $3)
  RETURNING id, name, description, category_id
`;
