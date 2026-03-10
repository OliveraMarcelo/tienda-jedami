export const CREATE_USER = `
    INSERT INTO users (email, password_hash)
    VALUES ($1,$2)
    RETURNING id, email;
`