INSERT INTO announcements (title, body, image_url, link_url, link_label, target_audience, active, sort_order) VALUES
  (
    '🔥 Nuevos ingresos esta semana',
    'Llegaron colecciones nuevas de verano. ¡Entrá al catálogo y descubrí las novedades!',
    'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=576&h=256&fit=crop&crop=center&q=85',
    '/catalogo',
    'Ver novedades',
    'all',
    TRUE,
    1
  ),
  (
    '💼 Precio especial mayorista',
    'Comprando más de 10 curvas tenés un 5% de descuento adicional. Contactanos para más info.',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=576&h=256&fit=crop&crop=center&q=85',
    NULL,
    NULL,
    'wholesale',
    TRUE,
    2
  ),
  (
    '🎁 Envío gratis en tu primera compra',
    'Solo para compradores minoristas nuevos. Válido hasta agotar stock.',
    'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=576&h=256&fit=crop&crop=center&q=85',
    '/catalogo',
    'Comprar ahora',
    'retail',
    TRUE,
    3
  ),
  (
    '📦 Tu pedido está en camino',
    'Podés rastrear el estado de tu pedido desde la sección Mis Pedidos.',
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=576&h=256&fit=crop&crop=center&q=85',
    '/pedidos',
    'Ver mis pedidos',
    'authenticated',
    TRUE,
    4
  );
