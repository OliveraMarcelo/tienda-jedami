BEGIN;

-- ─── Categorías ───────────────────────────────────────────────────────────────
INSERT INTO categories (name, slug) VALUES
  ('Remeras',    'remeras'),
  ('Bodies',     'bodies'),
  ('Pijamas',    'pijamas'),
  ('Pantalones', 'pantalones'),
  ('Conjuntos',  'conjuntos')
ON CONFLICT (slug) DO NOTHING;

-- ─── Asignar category_id a productos existentes ───────────────────────────────
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'remeras')
  WHERE name = 'Remera Bebé Algodón' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'remeras')
  WHERE name = 'Remera de niña' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'bodies')
  WHERE name = 'Body Manga Corta' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'pijamas')
  WHERE name = 'Pijama Polar' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'pantalones')
  WHERE name = 'Pantalón Jogger Bebé' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'conjuntos')
  WHERE name = 'Conjunto Verano' AND category_id IS NULL;

-- ─── Imágenes de ejemplo (Unsplash, libres de uso) ────────────────────────────
INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1522771930-78848d9293e8?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Remera Bebé Algodón'
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id);

INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1617331721458-bd3bd3f9c7f8?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Body Manga Corta'
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id);

INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Pijama Polar'
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id);

INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1502781252888-9143ba7f074e?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Pantalón Jogger Bebé'
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id);

INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1476234251651-f353703a034d?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1543854589-fccb5c5a9e62?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Conjunto Verano'
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id);

INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1522771930-78848d9293e8?w=600&q=80', 0)
) AS img(url, position)
WHERE p.name = 'Remera de niña'
  AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id);

-- ─── Precios mayoristas (≈61% del minorista) ─────────────────────────────────
INSERT INTO product_prices (product_id, price_mode_id, price)
SELECT
  pp.product_id,
  (SELECT id FROM price_modes WHERE code = 'wholesale'),
  ROUND(pp.price * 0.61, 2)
FROM product_prices pp
WHERE pp.price_mode_id = (SELECT id FROM price_modes WHERE code = 'retail')
ON CONFLICT (product_id, price_mode_id) DO NOTHING;

COMMIT;
