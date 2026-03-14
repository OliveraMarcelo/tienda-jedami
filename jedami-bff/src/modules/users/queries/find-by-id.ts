export const FIND_USER_BY_ID = `
  SELECT id, email FROM users WHERE id = $1
`;
