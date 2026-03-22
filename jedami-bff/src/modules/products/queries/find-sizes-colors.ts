export const FIND_ALL_SIZES = `
  SELECT id, label, sort_order
  FROM sizes
  WHERE active = TRUE
  ORDER BY sort_order, label
`;

export const FIND_ALL_COLORS = `
  SELECT id, name, hex_code
  FROM colors
  WHERE active = TRUE
  ORDER BY name
`;
