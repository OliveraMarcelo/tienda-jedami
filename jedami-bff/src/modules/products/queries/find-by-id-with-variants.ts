export const FIND_PRODUCT_BY_ID_WITH_VARIANTS = `
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
  WHERE p.id = $1
  ORDER BY v.id
`;
