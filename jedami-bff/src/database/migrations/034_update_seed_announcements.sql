-- Actualizar imágenes de los anuncios de seed
UPDATE announcements SET image_url = 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=576&h=256&fit=crop&crop=center&q=85'
WHERE title LIKE '%Nuevos ingresos%';

UPDATE announcements SET image_url = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=576&h=256&fit=crop&crop=center&q=85'
WHERE title LIKE '%mayorista%';

UPDATE announcements SET image_url = 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=576&h=256&fit=crop&crop=center&q=85'
WHERE title LIKE '%Env%o gratis%';

UPDATE announcements SET image_url = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=576&h=256&fit=crop&crop=center&q=85'
WHERE title LIKE '%pedido%en camino%';
