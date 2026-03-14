export const FIND_ROLE_BY_ID = `
  SELECT id, name FROM roles WHERE id = $1
`;
