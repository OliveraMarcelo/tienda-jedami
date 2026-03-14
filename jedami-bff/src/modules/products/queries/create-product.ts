export const CREATE_PRODUCT = `
  INSERT INTO products (name, description)
  VALUES ($1, $2)
  RETURNING id, name, description
`;
