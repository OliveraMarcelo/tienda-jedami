// $1 = pageSize, $2 = offset, $3 = categoryId (INT | null — filtra por categoría si se especifica)
export const FIND_ALL_WITH_VARIANTS = `
  SELECT
    p.id                    AS product_id,
    p.name                  AS product_name,
    p.description           AS product_description,
    p.category_id           AS product_category_id,
    c.name                  AS product_category_name,
    pi.url                  AS image_url,
    v.id                    AS variant_id,
    v.size                  AS variant_size,
    v.color                 AS variant_color,
    v.retail_price          AS variant_retail_price,
    v.wholesale_price       AS variant_wholesale_price,
    s.quantity              AS stock_quantity
  FROM (
    SELECT id, name, description, category_id
    FROM products
    WHERE $3::INT IS NULL OR category_id = $3
    ORDER BY id
    LIMIT $1 OFFSET $2
  ) p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT url FROM product_images
    WHERE product_id = p.id
    ORDER BY position ASC, id ASC
    LIMIT 1
  ) pi ON true
  LEFT JOIN variants v ON v.product_id = p.id
  LEFT JOIN stock s ON s.variant_id = v.id
  ORDER BY p.id, v.id
`;

// $1 = categoryId (INT | null)
export const COUNT_PRODUCTS = `
  SELECT COUNT(*)::int AS total
  FROM products
  WHERE $1::INT IS NULL OR category_id = $1
`;
