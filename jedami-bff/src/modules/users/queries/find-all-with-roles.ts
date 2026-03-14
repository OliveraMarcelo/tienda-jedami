export const FIND_ALL_WITH_ROLES = `
  SELECT
    u.id,
    u.email,
    u.created_at,
    ARRAY_REMOVE(ARRAY_AGG(r.name ORDER BY r.name), NULL) AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
  GROUP BY u.id
  ORDER BY u.id
`;
