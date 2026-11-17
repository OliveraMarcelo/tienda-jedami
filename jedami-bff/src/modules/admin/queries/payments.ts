// Una fila por pedido (también los que todavía no iniciaron un pago, como un pedido mayorista en armado).
// Un pedido puede tener varios registros de pago (la tienda prepara el QR de Mercado Pago y la
// transferencia a la vez, y cada reintento crea otro): se muestra el aprobado o, si no hay, el último,
// junto con todos los medios que se le ofrecieron.
// $1 = limit, $2 = offset, $3 = estado del pedido (NULL = todos), $4 = desde, $5 = hasta,
// $6 = búsqueda: email del cliente o número de pedido ("15" o "#15")
const ORDER_PAYMENTS = `
  WITH chosen AS (
    SELECT DISTINCT ON (p.order_id)
      p.order_id, p.id, p.status, p.payment_method, p.mp_payment_id, p.paid_at, p.created_at
    FROM payments p
    ORDER BY p.order_id, (p.status = 'approved') DESC, p.created_at DESC
  ),
  methods AS (
    SELECT order_id, array_agg(DISTINCT COALESCE(payment_method, 'mercadopago')) AS methods
    FROM payments
    GROUP BY order_id
  )
`;

const FILTERS = (status: string, from: string, to: string, search: string) => `
  WHERE (${status}::VARCHAR IS NULL OR o.status = ${status})
    AND (${from}::TIMESTAMPTZ IS NULL OR o.created_at >= ${from})
    AND (${to}::TIMESTAMPTZ IS NULL OR o.created_at <= ${to})
    AND (${search}::VARCHAR IS NULL
         OR u.email ILIKE '%' || ${search} || '%'
         OR o.id::TEXT = ltrim(${search}, '#'))
`;

export const ADMIN_PAYMENTS_QUERY = `
  ${ORDER_PAYMENTS}
  SELECT
    ch.id,
    o.id              AS order_id,
    ch.status         AS payment_status,
    ch.payment_method,
    ch.mp_payment_id,
    ch.paid_at,
    o.created_at,
    COALESCE(m.methods, '{}') AS methods,
    o.purchase_type,
    o.status          AS order_status,
    o.total_amount,
    o.notes,
    u.email           AS customer_email
  FROM orders o
  LEFT JOIN chosen ch  ON ch.order_id = o.id
  LEFT JOIN methods m  ON m.order_id = o.id
  JOIN customers c     ON c.id = o.customer_id
  JOIN users u         ON u.id = c.user_id
  ${FILTERS('$3', '$4', '$5', '$6')}
  ORDER BY o.created_at DESC
  LIMIT $1 OFFSET $2
`;

export const ADMIN_PAYMENTS_COUNT_QUERY = `
  SELECT COUNT(*) AS total
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  JOIN users u     ON u.id = c.user_id
  ${FILTERS('$1', '$2', '$3', '$4')}
`;
