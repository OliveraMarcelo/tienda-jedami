// Pedidos pagados (no despachados) con ítems pendientes de asignación o despacho.
// Parte A: curva/cantidad — ítems sin variante, join con variantes disponibles del mismo talle
// Parte B: menor — ítems con variante ya asignada, muestra datos de la variante
export const PENDING_FULFILLMENT_QUERY = `
  -- Parte A: curva y cantidad — ítems sin variante asignada
  SELECT
    o.id            AS order_id,
    o.created_at    AS order_created_at,
    o.total_amount  AS order_total,
    o.notes         AS order_notes,
    o.purchase_type AS purchase_type,
    u.email         AS customer_email,
    oi.id           AS item_id,
    oi.size_id,
    sz.label        AS size_label,
    oi.quantity,
    oi.unit_price,
    oi.product_id,
    p.name          AS product_name,
    FALSE           AS variant_assigned,
    NULL::int       AS assigned_variant_id,
    NULL::text      AS assigned_color,
    NULL::text      AS assigned_hex,
    v.id            AS variant_id,
    cl.name         AS color_name,
    cl.hex_code     AS color_hex,
    COALESCE(s.quantity, 0) AS stock_quantity
  FROM orders o
  JOIN customers c    ON c.id = o.customer_id
  JOIN users u        ON u.id = c.user_id
  JOIN order_items oi ON oi.order_id = o.id
                      AND oi.variant_id IS NULL
                      AND oi.size_id IS NOT NULL
  JOIN sizes sz       ON sz.id = oi.size_id
  JOIN products p     ON p.id = oi.product_id
  LEFT JOIN variants v  ON v.product_id = oi.product_id
                        AND v.size_id = oi.size_id
                        AND v.active = TRUE
  LEFT JOIN colors cl   ON cl.id = v.color_id
  LEFT JOIN stock s     ON s.variant_id = v.id
  WHERE o.status = 'paid'
    AND o.purchase_type IN ('curva', 'cantidad')

  UNION ALL

  -- Parte B: menor — ítems con variante ya asignada
  SELECT
    o.id,
    o.created_at,
    o.total_amount,
    o.notes,
    o.purchase_type,
    u.email,
    oi.id,
    v.size_id,
    sz.label,
    oi.quantity,
    oi.unit_price,
    oi.product_id,
    p.name,
    TRUE            AS variant_assigned,
    v.id            AS assigned_variant_id,
    cl.name         AS assigned_color,
    cl.hex_code     AS assigned_hex,
    NULL::int,
    NULL::text,
    NULL::text,
    NULL::int
  FROM orders o
  JOIN customers c    ON c.id = o.customer_id
  JOIN users u        ON u.id = c.user_id
  JOIN order_items oi ON oi.order_id = o.id
                      AND oi.variant_id IS NOT NULL
  JOIN variants v     ON v.id = oi.variant_id
  JOIN sizes sz       ON sz.id = v.size_id
  JOIN colors cl      ON cl.id = v.color_id
  JOIN products p     ON p.id = oi.product_id
  WHERE o.status = 'paid'
    AND o.purchase_type = 'menor'

  ORDER BY order_created_at ASC, item_id, variant_id
`;
