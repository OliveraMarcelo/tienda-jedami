// $1 = limit, $2 = offset, $3 = role filter (NULL = todos), $4 = search email (NULL = sin filtro)
export const ADMIN_USERS_QUERY = `
  SELECT
    u.id,
    u.email,
    u.created_at,
    json_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL) AS roles,
    c.id       AS customer_id,
    c.customer_type  AS customer_type
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id  = u.id
  LEFT JOIN roles r       ON r.id        = ur.role_id
  LEFT JOIN customers c   ON c.user_id   = u.id
  WHERE ($3::VARCHAR IS NULL OR r.name = $3)
    AND ($4::VARCHAR IS NULL OR u.email ILIKE '%' || $4 || '%')
  GROUP BY u.id, u.email, u.created_at, c.id, c.customer_type
  ORDER BY u.created_at DESC
  LIMIT $1 OFFSET $2
`;

export const ADMIN_USERS_COUNT_QUERY = `
  SELECT COUNT(DISTINCT u.id) AS total
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r       ON r.id       = ur.role_id
  WHERE ($1::VARCHAR IS NULL OR r.name = $1)
    AND ($2::VARCHAR IS NULL OR u.email ILIKE '%' || $2 || '%')
`;
