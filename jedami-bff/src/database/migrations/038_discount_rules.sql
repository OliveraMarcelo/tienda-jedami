-- 038_discount_rules.sql
-- Escalones de descuento por volumen (cantidad y curva) y mínimo de compra por producto

BEGIN;

-- Escalones de descuento por cantidad de unidades
CREATE TABLE quantity_discount_rules (
  id           SERIAL PRIMARY KEY,
  product_id   INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INT           NOT NULL CHECK (min_quantity > 0),
  discount_pct NUMERIC(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct < 100),
  active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, min_quantity)
);

CREATE INDEX idx_qdr_product_active ON quantity_discount_rules(product_id, active);

-- Escalones de descuento por número de curvas
CREATE TABLE curva_discount_rules (
  id           SERIAL PRIMARY KEY,
  product_id   INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_curves   INT           NOT NULL CHECK (min_curves > 0),
  discount_pct NUMERIC(5,2) NOT NULL CHECK (discount_pct > 0 AND discount_pct < 100),
  active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, min_curves)
);

CREATE INDEX idx_cdr_product_active ON curva_discount_rules(product_id, active);

-- Mínimo de compra por producto (modalidad cantidad)
ALTER TABLE products
  ADD COLUMN min_quantity_purchase INT DEFAULT NULL
    CHECK (min_quantity_purchase IS NULL OR min_quantity_purchase > 0);

-- Columnas de descuento en ítems de pedido
ALTER TABLE order_items
  ADD COLUMN discount_pct        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ADD COLUMN original_unit_price NUMERIC(12,2) DEFAULT NULL;

COMMIT;
