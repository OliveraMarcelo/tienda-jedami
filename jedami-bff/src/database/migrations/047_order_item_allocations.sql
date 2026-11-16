-- Despacho con reparto por talle y color.
-- En los pedidos por curva y por cantidad el cliente no elige color: lo decide el admin al despachar,
-- repartiendo las unidades entre las variantes. El reparto queda guardado acá para descontar el stock
-- una sola vez y devolverlo exacto si hiciera falta.
CREATE TABLE IF NOT EXISTS order_item_allocations (
  id            SERIAL PRIMARY KEY,
  order_item_id INT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  variant_id    INT NOT NULL REFERENCES variants(id),
  quantity      INT NOT NULL CHECK (quantity > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_item_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_order_item_allocations_item ON order_item_allocations(order_item_id);

-- Si el stock de la línea ya se descontó (al comprar o al despachar).
-- Evita descontar dos veces y que una cancelación devuelva stock que nunca salió.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT FALSE;

-- Pedidos existentes: minorista y por cantidad descontaban el stock al comprar.
-- Las curvas se descontaban a mano y no quedaba registrado: se dejan en FALSE (no se devuelve stock que no se sabe si salió).
UPDATE order_items oi
SET stock_deducted = TRUE
FROM orders o
WHERE o.id = oi.order_id
  AND o.purchase_type IN ('retail', 'cantidad')
  AND oi.stock_deducted = FALSE;
