export const FIND_ORDER_BY_ID = `
  SELECT id, customer_id, purchase_type, status, total_amount, created_at
  FROM orders
  WHERE id = $1
`;

export const FIND_ORDER_ITEMS = `
  SELECT
    oi.id,
    oi.order_id,
    oi.variant_id,
    oi.product_id,
    oi.quantity,
    oi.unit_price,
    sz.label AS variant_size,
    cl.name  AS variant_color
  FROM order_items oi
  LEFT JOIN variants v ON v.id = oi.variant_id
  LEFT JOIN sizes sz   ON sz.id = v.size_id
  LEFT JOIN colors cl  ON cl.id = v.color_id
  WHERE oi.order_id = $1
  ORDER BY oi.id
`;
