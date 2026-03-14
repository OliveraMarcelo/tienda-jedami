BEGIN;

-- Productos de prueba para jedami (ropa de bebé / indumentaria mayorista)

INSERT INTO products (name, description) VALUES
  ('Remera Bebé Algodón', 'Remera de algodón peinado para bebé, suave y resistente'),
  ('Body Manga Corta', 'Body interior con broches para bebés de 0 a 18 meses'),
  ('Pijama Polar', 'Pijama de polar suave con pie, ideal para invierno'),
  ('Pantalón Jogger Bebé', 'Pantalón jogger con puño y cintura elástica'),
  ('Conjunto Verano', 'Conjunto remera + short de algodón para el verano')
ON CONFLICT DO NOTHING;

-- Variantes y stock para producto 1: Remera Bebé Algodón
INSERT INTO variants (product_id, size, color, retail_price)
SELECT p.id, v.size, v.color, v.retail_price
FROM products p
CROSS JOIN (VALUES
  ('0-3m',  'celeste',  1200.00),
  ('0-3m',  'rosa',     1200.00),
  ('3-6m',  'celeste',  1250.00),
  ('3-6m',  'rosa',     1250.00),
  ('6-9m',  'celeste',  1300.00),
  ('6-9m',  'rosa',     1300.00),
  ('9-12m', 'celeste',  1350.00),
  ('9-12m', 'blanco',   1350.00)
) AS v(size, color, retail_price)
WHERE p.name = 'Remera Bebé Algodón'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '0-3m'  AND v.color = 'celeste' THEN 15
    WHEN v.size = '0-3m'  AND v.color = 'rosa'    THEN 8
    WHEN v.size = '3-6m'  AND v.color = 'celeste' THEN 3
    WHEN v.size = '3-6m'  AND v.color = 'rosa'    THEN 0
    WHEN v.size = '6-9m'  AND v.color = 'celeste' THEN 12
    WHEN v.size = '6-9m'  AND v.color = 'rosa'    THEN 2
    WHEN v.size = '9-12m' AND v.color = 'celeste' THEN 7
    WHEN v.size = '9-12m' AND v.color = 'blanco'  THEN 5
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Remera Bebé Algodón'
ON CONFLICT (variant_id) DO NOTHING;

-- Variantes y stock para producto 2: Body Manga Corta
INSERT INTO variants (product_id, size, color, retail_price)
SELECT p.id, v.size, v.color, v.retail_price
FROM products p
CROSS JOIN (VALUES
  ('0-3m',   'blanco',  950.00),
  ('0-3m',   'celeste', 950.00),
  ('3-6m',   'blanco',  980.00),
  ('3-6m',   'celeste', 980.00),
  ('6-12m',  'blanco',  1020.00),
  ('12-18m', 'blanco',  1050.00)
) AS v(size, color, retail_price)
WHERE p.name = 'Body Manga Corta'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '0-3m'   AND v.color = 'blanco'  THEN 20
    WHEN v.size = '0-3m'   AND v.color = 'celeste' THEN 18
    WHEN v.size = '3-6m'   AND v.color = 'blanco'  THEN 1
    WHEN v.size = '3-6m'   AND v.color = 'celeste' THEN 0
    WHEN v.size = '6-12m'  AND v.color = 'blanco'  THEN 9
    WHEN v.size = '12-18m' AND v.color = 'blanco'  THEN 6
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Body Manga Corta'
ON CONFLICT (variant_id) DO NOTHING;

-- Variantes y stock para producto 3: Pijama Polar
INSERT INTO variants (product_id, size, color, retail_price)
SELECT p.id, v.size, v.color, v.retail_price
FROM products p
CROSS JOIN (VALUES
  ('3-6m',  'gris',   2800.00),
  ('3-6m',  'azul',   2800.00),
  ('6-12m', 'gris',   2950.00),
  ('6-12m', 'azul',   2950.00),
  ('1-2a',  'gris',   3100.00),
  ('1-2a',  'verde',  3100.00)
) AS v(size, color, retail_price)
WHERE p.name = 'Pijama Polar'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '3-6m'  AND v.color = 'gris'  THEN 5
    WHEN v.size = '3-6m'  AND v.color = 'azul'  THEN 4
    WHEN v.size = '6-12m' AND v.color = 'gris'  THEN 10
    WHEN v.size = '6-12m' AND v.color = 'azul'  THEN 2
    WHEN v.size = '1-2a'  AND v.color = 'gris'  THEN 0
    WHEN v.size = '1-2a'  AND v.color = 'verde' THEN 8
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Pijama Polar'
ON CONFLICT (variant_id) DO NOTHING;

-- Variantes y stock para producto 4: Pantalón Jogger Bebé
INSERT INTO variants (product_id, size, color, retail_price)
SELECT p.id, v.size, v.color, v.retail_price
FROM products p
CROSS JOIN (VALUES
  ('0-3m',  'gris',   1500.00),
  ('3-6m',  'gris',   1550.00),
  ('3-6m',  'negro',  1550.00),
  ('6-9m',  'gris',   1600.00),
  ('6-9m',  'negro',  1600.00),
  ('9-12m', 'azul',   1650.00)
) AS v(size, color, retail_price)
WHERE p.name = 'Pantalón Jogger Bebé'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '0-3m'  AND v.color = 'gris'  THEN 12
    WHEN v.size = '3-6m'  AND v.color = 'gris'  THEN 7
    WHEN v.size = '3-6m'  AND v.color = 'negro' THEN 3
    WHEN v.size = '6-9m'  AND v.color = 'gris'  THEN 0
    WHEN v.size = '6-9m'  AND v.color = 'negro' THEN 1
    WHEN v.size = '9-12m' AND v.color = 'azul'  THEN 9
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Pantalón Jogger Bebé'
ON CONFLICT (variant_id) DO NOTHING;

-- Variantes y stock para producto 5: Conjunto Verano
INSERT INTO variants (product_id, size, color, retail_price)
SELECT p.id, v.size, v.color, v.retail_price
FROM products p
CROSS JOIN (VALUES
  ('3-6m',   'amarillo', 2200.00),
  ('3-6m',   'verde',    2200.00),
  ('6-12m',  'amarillo', 2300.00),
  ('6-12m',  'verde',    2300.00),
  ('12-18m', 'amarillo', 2400.00)
) AS v(size, color, retail_price)
WHERE p.name = 'Conjunto Verano'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '3-6m'   AND v.color = 'amarillo' THEN 6
    WHEN v.size = '3-6m'   AND v.color = 'verde'    THEN 0
    WHEN v.size = '6-12m'  AND v.color = 'amarillo' THEN 14
    WHEN v.size = '6-12m'  AND v.color = 'verde'    THEN 3
    WHEN v.size = '12-18m' AND v.color = 'amarillo' THEN 2
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Conjunto Verano'
ON CONFLICT (variant_id) DO NOTHING;

COMMIT;
