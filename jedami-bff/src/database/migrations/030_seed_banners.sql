INSERT INTO banners (image_url, link_url, sort_order, active)
SELECT url, link, ord, TRUE FROM (VALUES
  ('https://images.unsplash.com/photo-1522771930-78848d9293e8?w=1200&h=400&fit=crop', '/catalogo',            1),
  ('https://images.unsplash.com/photo-1476234251651-f353703a034d?w=1200&h=400&fit=crop', '/catalogo?categoria=3', 2),
  ('https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=1200&h=400&fit=crop', NULL,                  3)
) AS v(url, link, ord)
WHERE NOT EXISTS (SELECT 1 FROM banners);
