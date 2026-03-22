export const INSERT_PURCHASE_TYPE = `
  INSERT INTO purchase_types (code, label, active)
  VALUES ($1, $2, true)
  RETURNING id, code, label, active
`;
