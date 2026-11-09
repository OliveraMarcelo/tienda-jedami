-- Permite ocultar productos del catálogo público sin borrarlos
-- (ej. productos con pedidos asociados que no se pueden eliminar)
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
