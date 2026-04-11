export const FIND_PRODUCT_BY_ID = `
  SELECT id, name, description, min_quantity_purchase FROM products WHERE id = $1
`;
