export const FIND_PRODUCT_BY_ID = `
  SELECT id, name, description FROM products WHERE id = $1
`;
