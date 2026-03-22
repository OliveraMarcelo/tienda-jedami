-- Curva orders: items almacenados por talle sin variante asignada.
-- El admin asigna la variante (color) al despachar el pedido pagado.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size_id INT REFERENCES sizes(id);
