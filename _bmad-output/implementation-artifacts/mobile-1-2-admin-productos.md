# Story M1.2: Admin Panel Productos — Mobile Flutter

Status: review

## Story

Como administrador con la app móvil,
quiero crear y gestionar productos con variantes directamente desde mi celular,
para que pueda actualizar el catálogo desde el depósito sin necesitar la computadora.

**Depende de:** BFF Story 1.4 done (CRUD productos/variantes operativo) + M1.1 done (auth Flutter)

## Acceptance Criteria

1. **Given** el admin está autenticado en la app
   **When** entra a `/admin/productos`
   **Then** ve la lista de todos los productos con nombre y cantidad de variantes

2. **Given** el admin toca "Nuevo producto"
   **When** completa nombre + descripción y guarda
   **Then** se llama `POST /api/v1/products` y el producto aparece en la lista

3. **Given** el admin toca "Agregar variante" en un producto
   **When** completa talle, color, precio y stock inicial
   **Then** se llama `POST /api/v1/products/:id/variants` y la variante aparece en el detalle

4. **Given** la lista está cargando
   **When** la API no ha respondido aún
   **Then** se muestra un `CircularProgressIndicator` centrado (no blank screen)

## Tasks / Subtasks

- [x] Task 1 — Crear `ProductsNotifier` con Riverpod (AC: #1, #2, #3)
  - [x] StateNotifier<ProductsState> con products, loading, error
  - [x] fetchProducts(), createProduct(), createVariant() con DioException → error message

- [x] Task 2 — Crear `ProductsScreen` (AC: #1, #4)
  - [x] ConsumerStatefulWidget; fetchProducts en initState via microtask
  - [x] ListView.builder con ListTile + CircleAvatar + botón "Variante"
  - [x] FAB + para nuevo producto; RefreshIndicator para pull-to-refresh
  - [x] Loading, error (+ Reintentar) y empty state

- [x] Task 3 — Crear `ProductFormSheet` (AC: #2)
  - [x] showModalBottomSheet isScrollControlled + MediaQuery.viewInsets para teclado
  - [x] Validación nombre; spinner en botón guardar; DioException → _error

- [x] Task 4 — Crear `VariantFormSheet` (AC: #3)
  - [x] Grid 2 columnas talle/color + precio/stock
  - [x] _validatePositiveNumber helper; isInt=true para stock
  - [x] Título muestra nombre del producto

- [x] Task 5 — Ruta /admin/productos ya implementada en M1.1 con ProductsScreen

## Dev Notes

### Endpoints del BFF a consumir

```
GET /api/v1/products?page=1&pageSize=100
  Headers: Authorization: Bearer {token}
  Response 200: { data: [...], meta: { ... } }

POST /api/v1/products
  Headers: Authorization: Bearer {token}
  Body: { "name": "...", "description": "..." }
  Response 201: { data: { id, name, description } }

POST /api/v1/products/:id/variants
  Headers: Authorization: Bearer {token}
  Body: { "size": "L", "color": "azul", "retailPrice": 1500, "initialStock": 10 }
  Response 201: { data: { id, productId, size, color, retailPrice, stock: { quantity } } }
```

### Modelos Dart

```dart
// lib/features/products/models/product.dart
class Product {
  final int id;
  final String name;
  final String? description;
  final List<Variant> variants;

  factory Product.fromJson(Map<String, dynamic> json) => Product(
    id: json['id'],
    name: json['name'],
    description: json['description'],
    variants: (json['variants'] as List)
        .map((v) => Variant.fromJson(v)).toList(),
  );
}

class Variant {
  final int id;
  final String size;
  final String color;
  final double retailPrice;
  final int stockQuantity;

  factory Variant.fromJson(Map<String, dynamic> json) => Variant(
    id: json['id'],
    size: json['size'],
    color: json['color'],
    retailPrice: (json['retailPrice'] as num).toDouble(),
    stockQuantity: json['stock']['quantity'],
  );
}
```

### Estructura de directorios

```
jedami-mobile/lib/
├── features/
│   ├── auth/            (ya existe de M1.1)
│   └── products/
│       ├── models/
│       │   └── product.dart       (NUEVO)
│       ├── providers/
│       │   └── products_provider.dart  (NUEVO)
│       └── screens/
│           ├── products_screen.dart    (NUEVO)
│           ├── product_form_sheet.dart (NUEVO)
│           └── variant_form_sheet.dart (NUEVO)
```

### References

- BFF story 1.4: [Source: _bmad-output/implementation-artifacts/1-4-crud-de-productos-con-variantes.md]
- M1.1 (auth, Dio client): [Source: _bmad-output/implementation-artifacts/mobile-1-1-setup-flutter.md]
- Architecture — jedami-mobile (Riverpod, Dio): [Source: _bmad-output/planning-artifacts/architecture.md#Starters Utilizados]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: products_provider.dart con _dioProvider que crea Dio + AuthInterceptor (ref del provider). ProductsState inmutable con copyWith. createProduct construye Product con variants vacíos para append inmediato.
- Task 2: ProductsScreen ConsumerStatefulWidget con fetchProducts en microtask del initState. RefreshIndicator para pull-to-refresh. Tres estados: loading (CircularProgressIndicator), error (texto + Reintentar), empty (icono + mensaje).
- Task 3: ProductFormSheet con Padding(EdgeInsets.fromLTRB(..., bottom)) para manejar teclado.
- Task 4: VariantFormSheet con Row de 2 TextFormField por fila. _validatePositiveNumber centraliza validación.
- Task 5: app.dart ya tenía /admin/productos (M1.1). Actualizado import a ProductsScreen directamente.

### File List

- `jedami-mobile/lib/features/products/models/product.dart` (NUEVO — Product, Variant con fromJson)
- `jedami-mobile/lib/features/products/providers/products_provider.dart` (NUEVO — ProductsNotifier, productsProvider)
- `jedami-mobile/lib/features/products/screens/products_screen.dart` (NUEVO — ProductsScreen completo)
- `jedami-mobile/lib/features/products/screens/product_form_sheet.dart` (NUEVO)
- `jedami-mobile/lib/features/products/screens/variant_form_sheet.dart` (NUEVO)
- `jedami-mobile/lib/features/admin/screens/admin_products_screen.dart` (MODIFICADO — re-export)
- `jedami-mobile/lib/app.dart` (MODIFICADO — import actualizado a ProductsScreen)
