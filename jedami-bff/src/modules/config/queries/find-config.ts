export const FIND_CONFIG = `
  SELECT
    (SELECT json_agg(json_build_object('id', id, 'name', name) ORDER BY id)
     FROM roles) AS roles,

    (SELECT json_agg(json_build_object('id', id, 'code', code, 'label', label) ORDER BY id)
     FROM price_modes) AS price_modes,

    (SELECT json_agg(json_build_object('id', id, 'code', code, 'label', label) ORDER BY id)
     FROM purchase_types WHERE active = TRUE) AS purchase_types,

    (SELECT json_agg(json_build_object('id', id, 'code', code, 'label', label) ORDER BY id)
     FROM customer_types WHERE active = TRUE) AS customer_types
`;
