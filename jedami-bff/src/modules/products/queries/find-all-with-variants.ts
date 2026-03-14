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
  FROM products p
  LEFT JOIN variants v ON v.product_id = p.id
  LEFT JOIN stock s ON s.variant_id = v.id
  ORDER BY p.id, v.id
  LIMIT $1 OFFSET $2
`;

export const COUNT_PRODUCTS = `
  SELECT COUNT(DISTINCT p.id)::int AS total FROM products p
`;
