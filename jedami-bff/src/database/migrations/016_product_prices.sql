BEGIN;

CREATE TABLE product_prices (
  product_id    INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_mode_id INT NOT NULL REFERENCES price_modes(id),
  price         NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  PRIMARY KEY (product_id, price_mode_id)
);

-- Migrar precios retail: promedio del retail_price de variantes por producto
INSERT INTO product_prices (product_id, price_mode_id, price)
SELECT
  v.product_id,
  pm.id,
  ROUND(AVG(v.retail_price), 2)
FROM variants v
CROSS JOIN (SELECT id FROM price_modes WHERE code = 'retail') pm
GROUP BY v.product_id, pm.id
ON CONFLICT DO NOTHING;

-- Migrar precios wholesale: promedio del wholesale_price de variantes (solo si existe)
INSERT INTO product_prices (product_id, price_mode_id, price)
SELECT
  v.product_id,
  pm.id,
  ROUND(AVG(v.wholesale_price), 2)
FROM variants v
CROSS JOIN (SELECT id FROM price_modes WHERE code = 'wholesale') pm
WHERE v.wholesale_price IS NOT NULL
GROUP BY v.product_id, pm.id
ON CONFLICT DO NOTHING;

COMMIT;
