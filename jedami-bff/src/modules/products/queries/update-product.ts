// $2 = name (NOT NULL en DB — usa COALESCE para no romper si viene undefined)
// $3 = description (nullable — se pasa el valor final calculado en el service)
export const UPDATE_PRODUCT = `
  UPDATE products
  SET name = COALESCE($2, name),
      description = $3
  WHERE id = $1
  RETURNING id, name, description
`;
