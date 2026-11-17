// $1 = limit, $2 = offset, $3 = role filter (NULL = todos), $4 = search email (NULL = sin filtro),
// $5/$6 = alta desde/hasta (TIMESTAMPTZ, NULL = sin límite)
export const ADMIN_USERS_QUERY = `
  SELECT
    u.id,
    u.email,
    u.created_at,
    json_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
    c.id             AS customer_id,
    c.customer_type  AS customer_type
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r       ON r.id       = ur.role_id
  LEFT JOIN customers c   ON c.user_id  = u.id
  WHERE ($4::VARCHAR IS NULL OR u.email ILIKE '%' || $4 || '%')
    AND ($5::TIMESTAMPTZ IS NULL OR u.created_at >= $5)
    AND ($6::TIMESTAMPTZ IS NULL OR u.created_at <= $6)
    AND ($3::VARCHAR IS NULL OR EXISTS (
      SELECT 1 FROM user_roles ur2
      JOIN roles r2 ON r2.id = ur2.role_id
      WHERE ur2.user_id = u.id AND r2.name = $3
    ))
  GROUP BY u.id, u.email, u.created_at, c.id, c.customer_type
  ORDER BY u.created_at DESC
  LIMIT $1 OFFSET $2
`;

export const ADMIN_USERS_COUNT_QUERY = `
  SELECT COUNT(DISTINCT u.id) AS total
  FROM users u
  WHERE ($2::VARCHAR IS NULL OR u.email ILIKE '%' || $2 || '%')
    AND ($3::TIMESTAMPTZ IS NULL OR u.created_at >= $3)
    AND ($4::TIMESTAMPTZ IS NULL OR u.created_at <= $4)
    AND ($1::VARCHAR IS NULL OR EXISTS (
      SELECT 1 FROM user_roles ur2
      JOIN roles r2 ON r2.id = ur2.role_id
      WHERE ur2.user_id = u.id AND r2.name = $1
    ))
`;
