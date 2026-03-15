BEGIN;

-- Agregar columnas FK (nullable primero para migración de datos existentes)
ALTER TABLE variants ADD COLUMN size_id INT REFERENCES sizes(id);
ALTER TABLE variants ADD COLUMN color_id INT REFERENCES colors(id);

-- Mapear talles por coincidencia exacta de etiqueta
UPDATE variants v
SET size_id = s.id
FROM sizes s
WHERE s.label = v.size;

-- Mapear colores por coincidencia case-insensitive del nombre
UPDATE variants v
SET color_id = c.id
FROM colors c
WHERE LOWER(c.name) = LOWER(v.color);

-- Insertar colores faltantes para registros que no coincidieron
INSERT INTO colors (name, hex_code)
SELECT DISTINCT INITCAP(v.color), NULL
FROM variants v
WHERE v.color_id IS NULL
  AND v.color IS NOT NULL
  AND TRIM(v.color) != ''
ON CONFLICT (name) DO NOTHING;

-- Re-mapear colores luego de insertar nuevos
UPDATE variants v
SET color_id = c.id
FROM colors c
WHERE v.color_id IS NULL
  AND LOWER(c.name) = LOWER(v.color);

-- Insertar talles faltantes para registros que no coincidieron
INSERT INTO sizes (label, sort_order)
SELECT DISTINCT v.size, 999
FROM variants v
WHERE v.size_id IS NULL
  AND v.size IS NOT NULL
  AND TRIM(v.size) != ''
ON CONFLICT (label) DO NOTHING;

-- Re-mapear talles luego de insertar nuevos
UPDATE variants v
SET size_id = s.id
FROM sizes s
WHERE v.size_id IS NULL
  AND s.label = v.size;

-- Hacer las columnas NOT NULL
ALTER TABLE variants ALTER COLUMN size_id SET NOT NULL;
ALTER TABLE variants ALTER COLUMN color_id SET NOT NULL;

-- Eliminar columnas antiguas
ALTER TABLE variants DROP COLUMN size;
ALTER TABLE variants DROP COLUMN color;
ALTER TABLE variants DROP COLUMN retail_price;
ALTER TABLE variants DROP COLUMN wholesale_price;

-- Índices adicionales
CREATE INDEX idx_variants_size_id  ON variants(size_id);
CREATE INDEX idx_variants_color_id ON variants(color_id);

COMMIT;
