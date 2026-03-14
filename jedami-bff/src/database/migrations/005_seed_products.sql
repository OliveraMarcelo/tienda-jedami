BEGIN;

-- Seed de categorías
INSERT INTO categories (name, slug) VALUES
  ('Remeras',    'remeras'),
  ('Bodies',     'bodies'),
  ('Pijamas',    'pijamas'),
  ('Pantalones', 'pantalones'),
  ('Conjuntos',  'conjuntos')
ON CONFLICT (slug) DO NOTHING;

-- Productos con categorías asignadas
INSERT INTO products (name, description, category_id)
SELECT 'Remera Bebé Algodón', 'Remera de algodón peinado para bebé, suave y resistente. Costuras planas para mayor comodidad.', c.id
FROM categories c WHERE c.slug = 'remeras'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, category_id)
SELECT 'Body Manga Corta', 'Body interior con broches metálicos reforzados, tela 100% algodón jersey.', c.id
FROM categories c WHERE c.slug = 'bodies'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, category_id)
SELECT 'Pijama Polar', 'Pijama de polar suave con pie antideslizante, ideal para las noches de invierno.', c.id
FROM categories c WHERE c.slug = 'pijamas'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, category_id)
SELECT 'Pantalón Jogger Bebé', 'Pantalón jogger con puño reforzado y cintura elástica ancha para mayor comodidad.', c.id
FROM categories c WHERE c.slug = 'pantalones'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, category_id)
SELECT 'Conjunto Verano', 'Conjunto remera + short de algodón liviano para el verano. Diseños frescos y coloridos.', c.id
FROM categories c WHERE c.slug = 'conjuntos'
ON CONFLICT DO NOTHING;

-- ─── Variantes y stock: Remera Bebé Algodón ────────────────────────────────────
-- Talles 1–6, colores: celeste, rosa, blanco
INSERT INTO variants (product_id, size, color, retail_price, wholesale_price)
SELECT p.id, v.size, v.color, v.retail_price, v.wholesale_price
FROM products p
CROSS JOIN (VALUES
  ('1', 'celeste', 1800.00, 1100.00),
  ('1', 'rosa',    1800.00, 1100.00),
  ('2', 'celeste', 1900.00, 1160.00),
  ('2', 'rosa',    1900.00, 1160.00),
  ('3', 'blanco',  2000.00, 1220.00),
  ('3', 'celeste', 2000.00, 1220.00),
  ('4', 'blanco',  2100.00, 1280.00),
  ('4', 'rosa',    2100.00, 1280.00),
  ('5', 'celeste', 2200.00, 1340.00),
  ('5', 'blanco',  2200.00, 1340.00),
  ('6', 'rosa',    2300.00, 1400.00),
  ('6', 'celeste', 2300.00, 1400.00)
) AS v(size, color, retail_price, wholesale_price)
WHERE p.name = 'Remera Bebé Algodón'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '1' AND v.color = 'celeste' THEN 25
    WHEN v.size = '1' AND v.color = 'rosa'    THEN 22
    WHEN v.size = '2' AND v.color = 'celeste' THEN 28
    WHEN v.size = '2' AND v.color = 'rosa'    THEN 20
    WHEN v.size = '3' AND v.color = 'blanco'  THEN 30
    WHEN v.size = '3' AND v.color = 'celeste' THEN 27
    WHEN v.size = '4' AND v.color = 'blanco'  THEN 24
    WHEN v.size = '4' AND v.color = 'rosa'    THEN 21
    WHEN v.size = '5' AND v.color = 'celeste' THEN 26
    WHEN v.size = '5' AND v.color = 'blanco'  THEN 23
    WHEN v.size = '6' AND v.color = 'rosa'    THEN 20
    WHEN v.size = '6' AND v.color = 'celeste' THEN 29
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Remera Bebé Algodón'
ON CONFLICT (variant_id) DO NOTHING;

-- ─── Variantes y stock: Body Manga Corta ───────────────────────────────────────
-- Talles 1–6, colores: blanco, celeste
INSERT INTO variants (product_id, size, color, retail_price, wholesale_price)
SELECT p.id, v.size, v.color, v.retail_price, v.wholesale_price
FROM products p
CROSS JOIN (VALUES
  ('1', 'blanco',  1500.00,  900.00),
  ('1', 'celeste', 1500.00,  900.00),
  ('2', 'blanco',  1580.00,  950.00),
  ('2', 'celeste', 1580.00,  950.00),
  ('3', 'blanco',  1660.00, 1000.00),
  ('3', 'celeste', 1660.00, 1000.00),
  ('4', 'blanco',  1740.00, 1050.00),
  ('4', 'celeste', 1740.00, 1050.00),
  ('5', 'blanco',  1820.00, 1100.00),
  ('5', 'celeste', 1820.00, 1100.00),
  ('6', 'blanco',  1900.00, 1150.00),
  ('6', 'celeste', 1900.00, 1150.00)
) AS v(size, color, retail_price, wholesale_price)
WHERE p.name = 'Body Manga Corta'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '1' AND v.color = 'blanco'  THEN 30
    WHEN v.size = '1' AND v.color = 'celeste' THEN 28
    WHEN v.size = '2' AND v.color = 'blanco'  THEN 25
    WHEN v.size = '2' AND v.color = 'celeste' THEN 27
    WHEN v.size = '3' AND v.color = 'blanco'  THEN 22
    WHEN v.size = '3' AND v.color = 'celeste' THEN 24
    WHEN v.size = '4' AND v.color = 'blanco'  THEN 26
    WHEN v.size = '4' AND v.color = 'celeste' THEN 23
    WHEN v.size = '5' AND v.color = 'blanco'  THEN 21
    WHEN v.size = '5' AND v.color = 'celeste' THEN 20
    WHEN v.size = '6' AND v.color = 'blanco'  THEN 29
    WHEN v.size = '6' AND v.color = 'celeste' THEN 25
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Body Manga Corta'
ON CONFLICT (variant_id) DO NOTHING;

-- ─── Variantes y stock: Pijama Polar ───────────────────────────────────────────
-- Talles 1–6, colores: gris, azul, verde
INSERT INTO variants (product_id, size, color, retail_price, wholesale_price)
SELECT p.id, v.size, v.color, v.retail_price, v.wholesale_price
FROM products p
CROSS JOIN (VALUES
  ('1', 'gris',  3200.00, 1950.00),
  ('1', 'azul',  3200.00, 1950.00),
  ('2', 'gris',  3350.00, 2050.00),
  ('2', 'verde', 3350.00, 2050.00),
  ('3', 'azul',  3500.00, 2140.00),
  ('3', 'gris',  3500.00, 2140.00),
  ('4', 'verde', 3650.00, 2230.00),
  ('4', 'azul',  3650.00, 2230.00),
  ('5', 'gris',  3800.00, 2320.00),
  ('5', 'verde', 3800.00, 2320.00),
  ('6', 'azul',  3950.00, 2410.00),
  ('6', 'gris',  3950.00, 2410.00)
) AS v(size, color, retail_price, wholesale_price)
WHERE p.name = 'Pijama Polar'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '1' AND v.color = 'gris'  THEN 20
    WHEN v.size = '1' AND v.color = 'azul'  THEN 22
    WHEN v.size = '2' AND v.color = 'gris'  THEN 25
    WHEN v.size = '2' AND v.color = 'verde' THEN 23
    WHEN v.size = '3' AND v.color = 'azul'  THEN 28
    WHEN v.size = '3' AND v.color = 'gris'  THEN 26
    WHEN v.size = '4' AND v.color = 'verde' THEN 24
    WHEN v.size = '4' AND v.color = 'azul'  THEN 30
    WHEN v.size = '5' AND v.color = 'gris'  THEN 21
    WHEN v.size = '5' AND v.color = 'verde' THEN 27
    WHEN v.size = '6' AND v.color = 'azul'  THEN 29
    WHEN v.size = '6' AND v.color = 'gris'  THEN 20
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Pijama Polar'
ON CONFLICT (variant_id) DO NOTHING;

-- ─── Variantes y stock: Pantalón Jogger Bebé ───────────────────────────────────
-- Talles 1–6, colores: gris, negro, azul
INSERT INTO variants (product_id, size, color, retail_price, wholesale_price)
SELECT p.id, v.size, v.color, v.retail_price, v.wholesale_price
FROM products p
CROSS JOIN (VALUES
  ('1', 'gris',  2100.00, 1280.00),
  ('1', 'negro', 2100.00, 1280.00),
  ('2', 'gris',  2200.00, 1340.00),
  ('2', 'negro', 2200.00, 1340.00),
  ('3', 'azul',  2300.00, 1400.00),
  ('3', 'gris',  2300.00, 1400.00),
  ('4', 'negro', 2400.00, 1460.00),
  ('4', 'azul',  2400.00, 1460.00),
  ('5', 'gris',  2500.00, 1525.00),
  ('5', 'negro', 2500.00, 1525.00),
  ('6', 'azul',  2600.00, 1590.00),
  ('6', 'gris',  2600.00, 1590.00)
) AS v(size, color, retail_price, wholesale_price)
WHERE p.name = 'Pantalón Jogger Bebé'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '1' AND v.color = 'gris'  THEN 26
    WHEN v.size = '1' AND v.color = 'negro' THEN 24
    WHEN v.size = '2' AND v.color = 'gris'  THEN 28
    WHEN v.size = '2' AND v.color = 'negro' THEN 22
    WHEN v.size = '3' AND v.color = 'azul'  THEN 30
    WHEN v.size = '3' AND v.color = 'gris'  THEN 25
    WHEN v.size = '4' AND v.color = 'negro' THEN 20
    WHEN v.size = '4' AND v.color = 'azul'  THEN 27
    WHEN v.size = '5' AND v.color = 'gris'  THEN 23
    WHEN v.size = '5' AND v.color = 'negro' THEN 21
    WHEN v.size = '6' AND v.color = 'azul'  THEN 29
    WHEN v.size = '6' AND v.color = 'gris'  THEN 26
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Pantalón Jogger Bebé'
ON CONFLICT (variant_id) DO NOTHING;

-- ─── Variantes y stock: Conjunto Verano ────────────────────────────────────────
-- Talles 1–6, colores: amarillo, verde, coral
INSERT INTO variants (product_id, size, color, retail_price, wholesale_price)
SELECT p.id, v.size, v.color, v.retail_price, v.wholesale_price
FROM products p
CROSS JOIN (VALUES
  ('1', 'amarillo', 2800.00, 1710.00),
  ('1', 'coral',    2800.00, 1710.00),
  ('2', 'amarillo', 2950.00, 1800.00),
  ('2', 'verde',    2950.00, 1800.00),
  ('3', 'coral',    3100.00, 1890.00),
  ('3', 'amarillo', 3100.00, 1890.00),
  ('4', 'verde',    3250.00, 1980.00),
  ('4', 'coral',    3250.00, 1980.00),
  ('5', 'amarillo', 3400.00, 2075.00),
  ('5', 'verde',    3400.00, 2075.00),
  ('6', 'coral',    3550.00, 2165.00),
  ('6', 'amarillo', 3550.00, 2165.00)
) AS v(size, color, retail_price, wholesale_price)
WHERE p.name = 'Conjunto Verano'
ON CONFLICT DO NOTHING;

INSERT INTO stock (variant_id, quantity)
SELECT v.id,
  CASE
    WHEN v.size = '1' AND v.color = 'amarillo' THEN 22
    WHEN v.size = '1' AND v.color = 'coral'    THEN 20
    WHEN v.size = '2' AND v.color = 'amarillo' THEN 25
    WHEN v.size = '2' AND v.color = 'verde'    THEN 28
    WHEN v.size = '3' AND v.color = 'coral'    THEN 30
    WHEN v.size = '3' AND v.color = 'amarillo' THEN 24
    WHEN v.size = '4' AND v.color = 'verde'    THEN 21
    WHEN v.size = '4' AND v.color = 'coral'    THEN 26
    WHEN v.size = '5' AND v.color = 'amarillo' THEN 29
    WHEN v.size = '5' AND v.color = 'verde'    THEN 23
    WHEN v.size = '6' AND v.color = 'coral'    THEN 27
    WHEN v.size = '6' AND v.color = 'amarillo' THEN 20
    ELSE 0
  END
FROM variants v
JOIN products p ON p.id = v.product_id
WHERE p.name = 'Conjunto Verano'
ON CONFLICT (variant_id) DO NOTHING;

COMMIT;
