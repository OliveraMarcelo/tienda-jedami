// $1 email, $2 password_hash (NULL en cuentas de Google), $3 ya verificado (boolean), $4 google_sub
export const CREATE_USER = `
  INSERT INTO users (email, password_hash, email_verified_at, google_sub)
  VALUES ($1, $2, CASE WHEN $3::BOOLEAN THEN NOW() ELSE NULL END, $4)
  RETURNING id, email, password_hash, created_at, email_verified_at, google_sub;
`;
