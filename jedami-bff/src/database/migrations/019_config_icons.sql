BEGIN;

-- Agregar columna icon a las tablas de configuración
ALTER TABLE customer_types  ADD COLUMN icon VARCHAR(10) DEFAULT NULL;
ALTER TABLE purchase_types  ADD COLUMN icon VARCHAR(10) DEFAULT NULL;
ALTER TABLE price_modes     ADD COLUMN icon VARCHAR(10) DEFAULT NULL;

-- Seed de iconos
UPDATE customer_types SET icon = '🛍️' WHERE code = 'retail';
UPDATE customer_types SET icon = '🏭' WHERE code = 'wholesale';

UPDATE purchase_types SET icon = '📦' WHERE code = 'curva';
UPDATE purchase_types SET icon = '🔢' WHERE code = 'cantidad';
UPDATE purchase_types SET icon = '🛒' WHERE code = 'retail';

UPDATE price_modes SET icon = '🛍️' WHERE code = 'retail';
UPDATE price_modes SET icon = '🏭' WHERE code = 'wholesale';

COMMIT;
