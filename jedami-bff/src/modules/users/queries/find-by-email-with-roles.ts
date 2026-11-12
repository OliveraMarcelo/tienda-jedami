export const FIND_BY_EMAIL_WITH_ROLES = `
  SELECT
    u.id,
    u.email,
    u.password_hash,
    u.created_at,
    u.email_verified_at,
    u.google_sub,
    r.name AS role_name
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
  WHERE u.id = (SELECT id FROM users WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1)
`;
