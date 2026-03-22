// $1 = limit, $2 = offset, $3 = status filter (NULL = todos), $4 = date_from (NULL = sin filtro), $5 = date_to
export const ADMIN_PAYMENTS_QUERY = `
  SELECT
    p.id,
    p.order_id,
    p.status         AS payment_status,
    p.payment_method,
    p.amount,
    p.paid_at,
    p.created_at,
    o.purchase_type,
    o.status        AS order_status,
    o.total_amount,
    o.notes,
    u.email         AS customer_email
  FROM payments p
  JOIN orders o    ON o.id  = p.order_id
  JOIN customers c ON c.id  = o.customer_id
  JOIN users u     ON u.id  = c.user_id
  WHERE ($3::VARCHAR IS NULL OR p.status = $3)
    AND ($4::TIMESTAMPTZ IS NULL OR p.created_at >= $4)
    AND ($5::TIMESTAMPTZ IS NULL OR p.created_at <= $5)
  ORDER BY p.created_at DESC
  LIMIT $1 OFFSET $2
`;

export const ADMIN_PAYMENTS_COUNT_QUERY = `
  SELECT COUNT(*) AS total
  FROM payments p
  WHERE ($1::VARCHAR IS NULL OR p.status = $1)
    AND ($2::TIMESTAMPTZ IS NULL OR p.created_at >= $2)
    AND ($3::TIMESTAMPTZ IS NULL OR p.created_at <= $3)
`;
