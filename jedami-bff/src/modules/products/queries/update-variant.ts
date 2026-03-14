// Actualiza retail_price y/o wholesale_price de una variante
// $1 = id, $2 = retail_price (COALESCE conserva el valor actual si es null), $3 = wholesale_price (nullable), $4 = product_id (para verificar pertenencia)
export const UPDATE_VARIANT = `
  UPDATE variants
  SET retail_price    = COALESCE($2::NUMERIC, retail_price),
      wholesale_price = $3
  WHERE id = $1 AND product_id = $4
  RETURNING id, product_id, size, color, retail_price, wholesale_price
`;

export const FIND_VARIANT_BY_ID = `
  SELECT id, product_id, size, color, retail_price, wholesale_price
  FROM variants
  WHERE id = $1
`;
