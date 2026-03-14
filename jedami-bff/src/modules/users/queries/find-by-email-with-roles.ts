export const FIND_BY_EMAIL_WITH_ROLES = `
  SELECT
    u.id,
    u.email,
    u.password_hash,
    u.created_at,
    r.name AS role_name
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
  WHERE u.email = $1;
`;
