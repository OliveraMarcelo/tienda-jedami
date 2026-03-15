export const FIND_PRODUCT_BY_ID_WITH_VARIANTS = `
  SELECT
    p.id                      AS product_id,
    p.name                    AS product_name,
    p.description             AS product_description,
    p.category_id             AS product_category_id,
    c.name                    AS product_category_name,
    rp.price                  AS product_retail_price,
    wp.price                  AS product_wholesale_price,
    v.id                      AS variant_id,
    v.size_id                 AS variant_size_id,
    sz.label                  AS variant_size,
    v.color_id                AS variant_color_id,
    cl.name                   AS variant_color,
    cl.hex_code               AS variant_color_hex,
    s.quantity                AS stock_quantity
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN (
    SELECT pp.product_id, pp.price
    FROM product_prices pp
    JOIN price_modes pm ON pm.id = pp.price_mode_id AND pm.code = 'retail'
  ) rp ON rp.product_id = p.id
  LEFT JOIN (
    SELECT pp.product_id, pp.price
    FROM product_prices pp
    JOIN price_modes pm ON pm.id = pp.price_mode_id AND pm.code = 'wholesale'
  ) wp ON wp.product_id = p.id
  LEFT JOIN variants v ON v.product_id = p.id
  LEFT JOIN sizes sz ON sz.id = v.size_id
  LEFT JOIN colors cl ON cl.id = v.color_id
  LEFT JOIN stock s ON s.variant_id = v.id
  WHERE p.id = $1
  ORDER BY sz.sort_order NULLS LAST, cl.name
`;
