export const CREATE_STOCK = `
  INSERT INTO stock (variant_id, quantity)
  VALUES ($1, $2)
`;
