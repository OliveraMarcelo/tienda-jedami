// Solo pedidos vendidos (pagados o despachados).
// Las líneas minoristas guardan la variante (no el producto): el producto sale de la variante.
export const REPORTS_QUERY = `
  WITH top_products AS (
    SELECT
      p.id                               AS product_id,
      p.name,
      SUM(oi.quantity)                   AS total_units,
      SUM(oi.quantity * oi.unit_price)   AS total_revenue
    FROM order_items oi
    LEFT JOIN variants v ON v.id = oi.variant_id
    JOIN products p ON p.id = COALESCE(oi.product_id, v.product_id)
    JOIN orders   o ON o.id = oi.order_id
    WHERE o.status IN ('paid', 'shipped')
    GROUP BY p.id, p.name
    ORDER BY total_units DESC
    LIMIT $1
  ),
  top_customers AS (
    SELECT
      c.id                    AS customer_id,
      u.email,
      COUNT(o.id)             AS total_orders,
      SUM(o.total_amount)     AS total_revenue
    FROM customers c
    JOIN users  u ON u.id = c.user_id
    JOIN orders o ON o.customer_id = c.id
    WHERE o.status IN ('paid', 'shipped')
    GROUP BY c.id, u.email
    ORDER BY total_revenue DESC
    LIMIT $1
  )
  SELECT
    (SELECT COALESCE(json_agg(tp), '[]'::json) FROM top_products tp) AS top_products,
    (SELECT COALESCE(json_agg(tc), '[]'::json) FROM top_customers tc) AS top_customers
`;
