export const FIND_DEVICES = `
  SELECT id, mp_device_id, name, operating_mode, active, created_at
  FROM pos_devices
  ORDER BY active DESC, id ASC
`;
