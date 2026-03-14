// Subquery interna pagina sobre products (no sobre filas del JOIN)
// Esto evita que un producto quede partido entre páginas cuando tiene varias variantes
export const FIND_ALL_WITH_VARIANTS = `
  SELECT
    p.id           AS product_id,
    p.name         AS product_name,
    p.description  AS product_description,
    v.id           AS variant_id,
    v.size         AS variant_size,
    v.color        AS variant_color,
    v.retail_price AS variant_retail_price,
    s.quantity     AS stock_quantity
  FROM (SELECT id, name, description FROM products ORDER BY id LIMIT $1 OFFSET $2) p
  LEFT JOIN variants v ON v.product_id = p.id
  LEFT JOIN stock s ON s.variant_id = v.id
  ORDER BY p.id, v.id
`;

export const COUNT_PRODUCTS = `
  SELECT COUNT(*)::int AS total FROM products
`;
