export const UPSERT_DEVICE = `
  INSERT INTO pos_devices (mp_device_id, name, operating_mode, active)
  VALUES ($1, $2, $3, TRUE)
  ON CONFLICT (mp_device_id) DO UPDATE
    SET name           = EXCLUDED.name,
        operating_mode = EXCLUDED.operating_mode
  RETURNING id, mp_device_id, name, operating_mode, active, created_at
`;
