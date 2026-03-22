export const INSERT_CUSTOMER_TYPE = `
  INSERT INTO customer_types (code, label, active)
  VALUES ($1, $2, true)
  RETURNING id, code, label, active
`;
