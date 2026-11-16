// Despacho: pedidos pagados, sus líneas y la grilla talle × color de cada producto.

export const PAID_ORDERS_QUERY = `
  SELECT o.id, o.created_at, o.total_amount, o.notes, o.purchase_type, u.email AS customer_email
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN users u     ON u.id = c.user_id
  WHERE o.status = 'paid'
  ORDER BY o.created_at ASC
`;

// Las líneas minoristas tienen variante (y de ahí el producto y el talle); las de curva tienen producto y talle;
// las de cantidad, solo producto.
export const ORDER_LINES_QUERY = `
  SELECT
    oi.id,
    oi.order_id,
    COALESCE(oi.product_id, v.product_id) AS product_id,
    p.name                                AS product_name,
    COALESCE(oi.size_id, v.size_id)       AS size_id,
    sz.label                              AS size_label,
    sz.sort_order                         AS size_order,
    oi.variant_id,
    oi.quantity,
    oi.stock_deducted
  FROM order_items oi
  LEFT JOIN variants v ON v.id = oi.variant_id
  JOIN products p      ON p.id = COALESCE(oi.product_id, v.product_id)
  LEFT JOIN sizes sz   ON sz.id = COALESCE(oi.size_id, v.size_id)
  WHERE oi.order_id = ANY($1)
  ORDER BY oi.order_id, p.name, oi.id
`;

// Variantes activas de los productos (más las ya elegidas en una compra minorista, aunque se hayan desactivado)
export const PRODUCT_VARIANTS_QUERY = `
  SELECT
    v.id, v.product_id, v.size_id, sz.label AS size_label, sz.sort_order AS size_order,
    v.color_id, cl.name AS color_name, cl.hex_code AS color_hex,
    COALESCE(s.quantity, 0) AS stock
  FROM variants v
  JOIN sizes sz      ON sz.id = v.size_id
  JOIN colors cl     ON cl.id = v.color_id
  LEFT JOIN stock s  ON s.variant_id = v.id
  WHERE v.product_id = ANY($1)
    AND (v.active = TRUE OR v.id = ANY($2))
  ORDER BY v.product_id, sz.sort_order, sz.id, cl.name
`;
