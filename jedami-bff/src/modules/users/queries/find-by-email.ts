export const FIND_BY_EMAIL = `
    SELECT id,email,password_hash FROM users
    WHERE email = $1;
`