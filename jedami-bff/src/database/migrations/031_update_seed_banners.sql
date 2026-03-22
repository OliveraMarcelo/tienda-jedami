-- Reemplazar banners de ejemplo con imágenes de mayor calidad y dimensiones correctas
DELETE FROM banners;

INSERT INTO banners (image_url, link_url, sort_order, active) VALUES
  (
    'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1400&h=640&fit=crop&crop=center&q=85',
    '/catalogo',
    1,
    TRUE
  ),
  (
    'https://images.unsplash.com/photo-1519457431-44ccd64a579b?w=1400&h=640&fit=crop&crop=center&q=85',
    '/catalogo',
    2,
    TRUE
  ),
  (
    'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=1400&h=640&fit=crop&crop=center&q=85',
    '/catalogo',
    3,
    TRUE
  ),
  (
    'https://images.unsplash.com/photo-1503944583220-79d4dd712b41?w=1400&h=640&fit=crop&crop=top&q=85',
    '/catalogo',
    4,
    TRUE
  );
