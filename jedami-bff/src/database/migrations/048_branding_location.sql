-- Ubicación del local físico, para mostrar en el pie de la tienda
ALTER TABLE branding
  ADD COLUMN IF NOT EXISTS location_name     VARCHAR(120),
  ADD COLUMN IF NOT EXISTS location_stall    VARCHAR(40),
  ADD COLUMN IF NOT EXISTS location_aisle    VARCHAR(40),
  ADD COLUMN IF NOT EXISTS location_maps_url VARCHAR(500);

UPDATE branding SET location_name = 'Quivincha, La Salada' WHERE id = 1 AND location_name IS NULL;
