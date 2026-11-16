// Pedidos vendidos = pagados (para despachar) + despachados
export const DASHBOARD_QUERY = `
  SELECT
    COUNT(*) FILTER (WHERE status IN ('paid', 'shipped'))  AS total_orders,
    COUNT(*) FILTER (WHERE status = 'pending')             AS pending_orders,
    COUNT(*) FILTER (WHERE status = 'paid')                AS paid_orders,
    COUNT(*) FILTER (WHERE status = 'shipped')             AS shipped_orders,
    COUNT(*) FILTER (WHERE status = 'rejected')            AS rejected_orders,

    COALESCE(SUM(total_amount) FILTER (WHERE status IN ('paid', 'shipped')), 0) AS total_revenue,
    COALESCE(SUM(total_amount) FILTER (
      WHERE status IN ('paid', 'shipped')
        AND created_at >= NOW() - INTERVAL '30 days'
    ), 0) AS revenue_last_30d,

    -- Ventas por tipo de compra
    COUNT(*) FILTER (WHERE purchase_type = 'retail'   AND status IN ('paid', 'shipped')) AS retail_orders,
    COUNT(*) FILTER (WHERE purchase_type = 'curva'    AND status IN ('paid', 'shipped')) AS curva_orders,
    COUNT(*) FILTER (WHERE purchase_type = 'cantidad' AND status IN ('paid', 'shipped')) AS cantidad_orders
  FROM orders
`;

export const RECENT_ORDERS_QUERY = `
  SELECT
    o.id,
    o.purchase_type,
    o.status,
    o.total_amount,
    o.created_at,
    u.email AS customer_email
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN users u     ON u.id = c.user_id
  ORDER BY o.created_at DESC
  LIMIT 10
`;
