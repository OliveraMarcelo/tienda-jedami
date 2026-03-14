export const FIND_ROLE_BY_NAME = `
  SELECT id, name FROM roles
  WHERE name = $1;
`;
