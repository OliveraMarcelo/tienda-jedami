BEGIN;

-- Fotos de ejemplo para cada producto (Unsplash, libres de uso)
INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1522771930-78848d9293e8?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Remera Bebé Algodón'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1617331721458-bd3bd3f9c7f8?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Body Manga Corta'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Pijama Polar'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1502781252888-9143ba7f074e?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Pantalón Jogger Bebé'
ON CONFLICT DO NOTHING;

INSERT INTO product_images (product_id, url, position)
SELECT p.id, img.url, img.position
FROM products p
CROSS JOIN (VALUES
  ('https://images.unsplash.com/photo-1476234251651-f353703a034d?w=600&q=80', 0),
  ('https://images.unsplash.com/photo-1543854589-fccb5c5a9e62?w=600&q=80', 1)
) AS img(url, position)
WHERE p.name = 'Conjunto Verano'
ON CONFLICT DO NOTHING;

COMMIT;
