BEGIN;

-- Insertar categorías
INSERT INTO categories (name, slug) VALUES
  ('Remeras',    'remeras'),
  ('Bodies',     'bodies'),
  ('Pijamas',    'pijamas'),
  ('Pantalones', 'pantalones'),
  ('Conjuntos',  'conjuntos')
ON CONFLICT (slug) DO NOTHING;

-- Asignar category_id a los productos
UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'remeras')
  WHERE name = 'Remera Bebé Algodón' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'bodies')
  WHERE name = 'Body Manga Corta' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'pijamas')
  WHERE name = 'Pijama Polar' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'pantalones')
  WHERE name = 'Pantalón Jogger Bebé' AND category_id IS NULL;

UPDATE products SET category_id = (SELECT id FROM categories WHERE slug = 'conjuntos')
  WHERE name = 'Conjunto Verano' AND category_id IS NULL;

-- Asignar wholesale_price a las variantes (≈61% del precio minorista)
UPDATE variants SET wholesale_price = ROUND(retail_price * 0.61, 2)
  WHERE wholesale_price IS NULL;

COMMIT;
