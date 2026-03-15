export const DASHBOARD_QUERY = `
  SELECT
    -- Totales de pedidos por estado
    COUNT(*)                                             AS total_orders,
    COUNT(*) FILTER (WHERE status = 'pending')           AS pending_orders,
    COUNT(*) FILTER (WHERE status = 'paid')              AS paid_orders,
    COUNT(*) FILTER (WHERE status = 'rejected')          AS rejected_orders,

    -- Revenue total (solo pedidos pagados)
    COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) AS total_revenue,

    -- Revenue últimos 30 días
    COALESCE(SUM(total_amount) FILTER (
      WHERE status = 'paid'
        AND created_at >= NOW() - INTERVAL '30 days'
    ), 0) AS revenue_last_30d,

    -- Pedidos por tipo de compra
    COUNT(*) FILTER (WHERE purchase_type = 'retail')     AS retail_orders,
    COUNT(*) FILTER (WHERE purchase_type = 'curva')      AS curva_orders,
    COUNT(*) FILTER (WHERE purchase_type = 'cantidad')   AS cantidad_orders

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
