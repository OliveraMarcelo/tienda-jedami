// $1 = product_id, $2 = price (numeric), $3 = mode code ('retail' | 'wholesale')
export const UPSERT_PRODUCT_PRICE = `
  INSERT INTO product_prices (product_id, price_mode_id, price)
  SELECT $1, id, $2
  FROM price_modes
  WHERE code = $3
  ON CONFLICT (product_id, price_mode_id)
  DO UPDATE SET price = EXCLUDED.price
`;

// $1 = product_id
export const FIND_PRODUCT_PRICES = `
  SELECT pm.code, pp.price
  FROM product_prices pp
  JOIN price_modes pm ON pm.id = pp.price_mode_id
  WHERE pp.product_id = $1
`;
