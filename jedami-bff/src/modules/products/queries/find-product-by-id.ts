// Incluye category_id y active: updateProduct los usa para conservar el valor
// actual cuando el body no los envía (antes faltaban y se pisaba la categoría con NULL)
export const FIND_PRODUCT_BY_ID = `
  SELECT id, name, description, category_id, active, min_quantity_purchase FROM products WHERE id = $1
`;
