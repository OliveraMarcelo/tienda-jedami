// $2 = name (usa COALESCE para conservar el valor actual si no se envía)
// $3 = description (nullable — se pasa el valor final calculado en el service)
// $4 = category_id (nullable — se pasa el valor final calculado en el service)
export const UPDATE_PRODUCT = `
  UPDATE products
  SET name        = COALESCE($2, name),
      description = $3,
      category_id = $4
  WHERE id = $1
  RETURNING id, name, description, category_id
`;
