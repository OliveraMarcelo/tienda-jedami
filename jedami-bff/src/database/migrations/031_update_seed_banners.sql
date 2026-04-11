-- Actualizar banners de ejemplo con imágenes de mayor calidad y dimensiones correctas
-- Idempotente: solo actualiza si la imagen de seed (baja calidad de 030) sigue siendo la misma
UPDATE banners SET
  image_url = 'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1400&h=640&fit=crop&crop=center&q=85'
WHERE sort_order = 1
  AND image_url = 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=1200&h=400&fit=crop';

UPDATE banners SET
  image_url = 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=1400&h=640&fit=crop&crop=center&q=85'
WHERE sort_order = 2
  AND image_url = 'https://images.unsplash.com/photo-1476234251651-f353703a034d?w=1200&h=400&fit=crop';

UPDATE banners SET
  image_url = 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=1400&h=640&fit=crop&crop=center&q=85'
WHERE sort_order = 3
  AND image_url = 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=1200&h=400&fit=crop';

-- Agregar cuarto banner si no existe (sort_order = 4)
INSERT INTO banners (image_url, link_url, sort_order, active)
SELECT 'https://images.unsplash.com/photo-1503944583220-79d4dd712b41?w=1400&h=640&fit=crop&crop=top&q=85', '/catalogo', 4, TRUE
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE sort_order = 4);
