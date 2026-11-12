// La comparación ignora mayúsculas: "Ana@Gmail.com" y "ana@gmail.com" son la misma cuenta
export const FIND_BY_EMAIL = `
  SELECT id, email, password_hash, created_at, email_verified_at, google_sub
  FROM users
  WHERE LOWER(email) = LOWER($1)
  ORDER BY id
  LIMIT 1
`;
