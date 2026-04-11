export const FIND_DEVICE_BY_ID = `
  SELECT id, mp_device_id, name, operating_mode, active, created_at
  FROM pos_devices
  WHERE id = $1
`;
