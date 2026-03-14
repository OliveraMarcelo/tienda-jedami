export const FIND_PRODUCT_BY_ID_WITH_VARIANTS = `
  SELECT
    p.id                    AS product_id,
    p.name                  AS product_name,
    p.description           AS product_description,
    p.category_id           AS product_category_id,
    c.name                  AS product_category_name,
    v.id                    AS variant_id,
    v.size                  AS variant_size,
    v.color                 AS variant_color,
    v.retail_price          AS variant_retail_price,
    v.wholesale_price       AS variant_wholesale_price,
    s.quantity              AS stock_quantity
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN variants v ON v.product_id = p.id
  LEFT JOIN stock s ON s.variant_id = v.id
  WHERE p.id = $1
  ORDER BY v.id
`;
