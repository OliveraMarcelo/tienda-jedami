-- Historial de ajustes de stock realizados por operadores desde la app desktop
CREATE TABLE stock_adjustments (
  id           SERIAL PRIMARY KEY,
  variant_id   INTEGER NOT NULL REFERENCES variants(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  old_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  adjusted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_adjustments_variant ON stock_adjustments(variant_id);
CREATE INDEX idx_stock_adjustments_user    ON stock_adjustments(user_id);
