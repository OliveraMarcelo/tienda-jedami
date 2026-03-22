export const UPDATE_CUSTOMER_TYPE = `
  UPDATE customer_types
  SET label  = COALESCE($2, label),
      active = COALESCE($3, active)
  WHERE id = $1
  RETURNING id, code, label, active
`;
