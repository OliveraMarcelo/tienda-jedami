# Schema de Base de Datos — tienda-jedami

> PostgreSQL. Motor de migraciones: SQL puro con `pg` Pool, sin ORM.
> Migraciones: `jedami-bff/src/database/migrations/001` → `017`.

---

## Tablas de Auth

### `roles`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `name` | VARCHAR(50) | UNIQUE NOT NULL | Nombre del rol (`admin`, `retail`, `wholesale`) |

**Seeds:** `admin`, `retail`, `wholesale` (migración `002`).

---

### `users`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `email` | VARCHAR(255) | UNIQUE NOT NULL | Email de login |
| `password_hash` | TEXT | NOT NULL | Hash bcrypt |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Fecha de registro |

---

### `user_roles`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `user_id` | INT | PK, FK → `users(id)` CASCADE | Usuario |
| `role_id` | INT | PK, FK → `roles(id)` CASCADE | Rol asignado |

**Clave primaria compuesta.** Un usuario puede tener múltiples roles.

---

### `refresh_tokens`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `user_id` | INT | FK → `users(id)` CASCADE | Propietario del token |
| `token_hash` | VARCHAR(64) | UNIQUE NOT NULL | SHA-256 del token |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Fecha de expiración |
| `revoked_at` | TIMESTAMPTZ | nullable | Fecha de revocación (logout) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de creación |

**Índices:** `user_id`, `token_hash`.

---

## Tablas de Clientes y Pedidos

### `customers`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `user_id` | INT | FK → `users(id)` CASCADE, UNIQUE | Usuario asociado |
| `customer_type` | VARCHAR(20) | CHECK (`retail`\|`wholesale`) DEFAULT `retail` | Tipo de cliente |

**Índice:** `user_id`.

---

### `orders`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `customer_id` | INT | FK → `customers(id)`, NOT NULL | Cliente que realizó el pedido |
| `purchase_type` | VARCHAR(20) | CHECK (`curva`\|`cantidad`\|`retail`) | Modalidad de compra |
| `status` | VARCHAR(20) | CHECK (`pending`\|`paid`\|`rejected`) DEFAULT `pending` | Estado del pedido |
| `total_amount` | NUMERIC(10,2) | NOT NULL DEFAULT 0 | Total en ARS |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de creación |

**Índice:** `customer_id`.

---

### `order_items`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `order_id` | INT | FK → `orders(id)` CASCADE, NOT NULL | Pedido padre |
| `variant_id` | INT | FK → `variants(id)`, nullable | Variante específica (minorista / curva) |
| `product_id` | INT | FK → `products(id)`, nullable | Producto (compra por cantidad total) |
| `quantity` | INT | CHECK > 0 | Cantidad solicitada |
| `unit_price` | NUMERIC(10,2) | NOT NULL | Precio unitario al momento de la compra (histórico) |

> `variant_id` y `product_id` son ambos nullable por diseño: compras por `cantidad` total referencian al producto, compras individuales referencian la variante.

**Índice:** `order_id`.

---

### `payments`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `order_id` | INT | FK → `orders(id)`, NOT NULL | Pedido pagado |
| `mp_preference_id` | VARCHAR(200) | nullable | ID de preferencia MercadoPago |
| `mp_payment_id` | VARCHAR(100) | nullable | ID de pago MercadoPago |
| `status` | VARCHAR(20) | CHECK (`pending`\|`approved`\|`rejected`) DEFAULT `pending` | Estado del pago |
| `amount` | NUMERIC(10,2) | nullable | Monto procesado |
| `paid_at` | TIMESTAMPTZ | nullable | Timestamp de aprobación |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de creación |

**Índices:** `order_id`, `mp_payment_id`.

---

## Tablas de Referencia

### `categories`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `name` | VARCHAR(100) | UNIQUE NOT NULL | Nombre visible |
| `slug` | VARCHAR(100) | UNIQUE NOT NULL | URL-friendly (ej: `remeras`) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de creación |

**Seeds:** Remeras, Bodies, Pijamas, Pantalones, Conjuntos.

---

### `sizes`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `label` | VARCHAR(20) | UNIQUE NOT NULL | Etiqueta del talle (ej: `RN`, `1`, `XL`) |
| `sort_order` | INT | NOT NULL DEFAULT 0 | Orden de presentación |

**Seeds (ordenados):** RN(10), 0(20), 1(30), 2(40), 3(50), 4(60), 5(70), 6(80), 8(90), 9(100), 10(110), 12(120), 14(130), 16(140), S(150), M(160), L(170), XL(180).

> `sort_order` resuelve el orden correcto de talles: `RN < 0 < 1 < … < 16 < S < M < L < XL`. Sin este campo, el orden sería alfabético (`0 < 1 < 10 < 12 < 14 < 16 < 2 < …`).

---

### `colors`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `name` | VARCHAR(50) | UNIQUE NOT NULL | Nombre del color (ej: `Rosa`) |
| `hex_code` | VARCHAR(7) | nullable | Código hexadecimal CSS (ej: `#F48FB1`) |

**Seeds:** Blanco, Negro, Gris, Rosa, Celeste, Amarillo, Verde, Rojo, Naranja, Lila, Beige, Azul, Azul marino, Coral, Estampado.

> `hex_code` es nullable porque `Estampado` no tiene representación hexadecimal.

---

### `price_modes`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `code` | VARCHAR(20) | UNIQUE NOT NULL | Código interno (`retail`, `wholesale`) |
| `label` | VARCHAR(50) | NOT NULL | Etiqueta visible (`Minorista`, `Mayorista`) |

**Seeds:** `retail` → Minorista, `wholesale` → Mayorista.

> Tabla de referencia extensible: agregar una nueva modalidad (ej: `distributor`) es solo un INSERT sin cambios de schema.

---

## Tablas de Productos

### `products`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `name` | VARCHAR(255) | NOT NULL | Nombre del producto |
| `description` | TEXT | nullable | Descripción larga |
| `category_id` | INT | FK → `categories(id)` SET NULL, nullable | Categoría |

**Índice:** `category_id`.

---

### `product_images`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `product_id` | INT | FK → `products(id)` CASCADE, NOT NULL | Producto propietario |
| `url` | TEXT | NOT NULL | URL del archivo (servido desde BFF `/uploads/products/`) |
| `position` | INT | NOT NULL DEFAULT 0 | Orden de visualización |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Fecha de subida |

**Índice:** `product_id`.

---

### `product_prices`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `product_id` | INT | PK, FK → `products(id)` CASCADE | Producto |
| `price_mode_id` | INT | PK, FK → `price_modes(id)` | Modalidad de precio |
| `price` | NUMERIC(10,2) | NOT NULL CHECK >= 0 | Precio en ARS |

**Clave primaria compuesta `(product_id, price_mode_id)`.** Un producto tiene exactamente un precio por modalidad.

> **Decisión arquitectónica:** Los precios se almacenan a nivel de producto, no de variante. Todas las variantes (talles/colores) de un mismo producto comparten el mismo precio minorista y mayorista. Esto refleja la realidad del negocio: ropa de bebé no tiene diferencias de precio por talle.

---

### `variants`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `id` | SERIAL | PK | Identificador |
| `product_id` | INT | FK → `products(id)` CASCADE, NOT NULL | Producto padre |
| `size_id` | INT | FK → `sizes(id)`, NOT NULL | Talle |
| `color_id` | INT | FK → `colors(id)`, NOT NULL | Color |

**Índices:** `product_id` (existente), `size_id`, `color_id` (nuevos en migración 017).

> Las variantes son la combinación talle × color de un producto. No almacenan precio (está en `product_prices`) ni stock (está en `stock`).

---

### `stock`
| Columna | Tipo | Constraints | Descripción |
|---|---|---|---|
| `variant_id` | INT | PK, FK → `variants(id)` CASCADE | Variante propietaria |
| `quantity` | INT | NOT NULL DEFAULT 0 CHECK >= 0 | Unidades disponibles |

> `variant_id` es la PK (no SERIAL). Garantiza relación 1-1 estricta con `variants` — imposible crear dos registros de stock para una misma variante.

---

## Índices registrados

| Tabla | Columna(s) | Nombre |
|---|---|---|
| `customers` | `user_id` | `idx_customers_user_id` |
| `orders` | `customer_id` | `idx_orders_customer_id` |
| `order_items` | `order_id` | `idx_order_items_order_id` |
| `payments` | `order_id` | `idx_payments_order_id` |
| `payments` | `mp_payment_id` | `idx_payments_mp_payment_id` |
| `refresh_tokens` | `user_id` | `idx_refresh_tokens_user_id` |
| `refresh_tokens` | `token_hash` | `idx_refresh_tokens_token_hash` |
| `products` | `category_id` | `idx_products_category_id` |
| `product_images` | `product_id` | `idx_product_images_product_id` |
| `variants` | `product_id` | `idx_variants_product_id` |
| `variants` | `size_id` | `idx_variants_size_id` |
| `variants` | `color_id` | `idx_variants_color_id` |

---

## Historial de migraciones

| Archivo | Descripción |
|---|---|
| `001_init.sql` | Tablas `roles`, `users`, `user_roles` |
| `002_seed_roles.sql` | Seeds: admin, retail, wholesale |
| `003_seed_admin.sql` | Usuario admin inicial |
| `004_products.sql` | Tablas `products`, `variants`, `stock` |
| `005_seed_products.sql` | 5 productos con variantes y stock |
| `006_customers_orders.sql` | Tablas `customers`, `orders`, `order_items` |
| `007_payments.sql` | Tabla `payments` |
| `008_retail_orders.sql` | Extiende CHECK `purchase_type` con `retail` |
| `009_refresh_tokens.sql` | Tabla `refresh_tokens` |
| `010_product_images.sql` | Tabla `product_images` |
| `011_wholesale_price.sql` | *(Deprecado en 016-017)* Columna temporal `wholesale_price` en `variants` |
| `012_categories.sql` | Tabla `categories`, columna `category_id` en `products` |
| `013_seed_categories_and_wholesale.sql` | Seeds de categorías y asignación de precios mayoristas al seed |
| `014_seed_product_images.sql` | Seeds de fotos de ejemplo |
| `015_reference_tables.sql` | Tablas `price_modes`, `sizes`, `colors` con seeds completos |
| `016_product_prices.sql` | Tabla `product_prices`, migración de precios desde `variants` |
| `017_variants_refactor.sql` | `variants` pasa a usar `size_id`/`color_id` FK; elimina `size`, `color`, `retail_price`, `wholesale_price` |
