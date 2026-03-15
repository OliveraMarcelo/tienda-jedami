export const FIND_VARIANT_BY_ID = `
  SELECT v.id, v.product_id, v.size_id, sz.label AS size, v.color_id, c.name AS color, c.hex_code
  FROM variants v
  JOIN sizes sz ON sz.id = v.size_id
  JOIN colors c  ON c.id  = v.color_id
  WHERE v.id = $1
`;
