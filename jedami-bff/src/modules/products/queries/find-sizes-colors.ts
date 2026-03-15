export const FIND_ALL_SIZES = `
  SELECT id, label, sort_order
  FROM sizes
  ORDER BY sort_order, label
`;

export const FIND_ALL_COLORS = `
  SELECT id, name, hex_code
  FROM colors
  ORDER BY name
`;
