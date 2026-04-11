# Story 8.2: Flutter Desktop — Gestión de Stock

Status: done

## Story

Como operador,
quiero ver y ajustar el stock de cada variante desde la app desktop,
para mantener el inventario actualizado en tiempo real.

## Acceptance Criteria

1. **Given** el operador está autenticado en la app desktop
   **When** navega a la vista de stock (`/desktop/stock`)
   **Then** ve la lista de productos con nombre, categoría e imagen
   **And** puede expandir cada producto para ver sus variantes con talle, color y stock actual

2. **Given** el operador modifica el stock de una variante
   **When** ingresa el nuevo valor y confirma
   **Then** el BFF actualiza el stock vía `PATCH /api/v1/admin/products/:productId/variants/:variantId/stock`
   **And** la vista muestra el valor actualizado sin recargar toda la pantalla

3. **Given** el BFF recibe la actualización de stock
   **When** la procesa
   **Then** registra el ajuste: quién lo hizo (`user_id`), cuándo (`timestamp`), variante y nuevo valor en una tabla `stock_adjustments`

4. **Given** el operador hace un ajuste
   **When** la operación falla (error de red o validación)
   **Then** la UI muestra el error y revierte el valor al original

## Tasks / Subtasks

**BFF — Endpoint y migración:**
- [x] Migración `039_stock_adjustments.sql`: tabla `stock_adjustments (id, variant_id, user_id, old_quantity, new_quantity, adjusted_at)` (AC: 3)
- [x] Handler `PATCH /admin/products/:productId/variants/:variantId/stock` en BFF (AC: 2, 3)
  - [x] Validar que el productId y variantId coincidan
  - [x] Actualizar `stock.quantity` WHERE `variant_id = $1`
  - [x] Insertar registro en `stock_adjustments`
  - [x] Retornar `{ variantId, newQuantity }`
  - [x] Requiere auth + rol admin
- [x] Agregar la ruta en `routes/admin.routes.ts`

**Flutter Desktop — UI:**
- [x] Provider `stock_provider.dart` con Riverpod (AC: 1, 2)
  - [x] `fetchProducts()` → `GET /api/v1/products?page=1&pageSize=200` para listar todos
  - [x] `updateStock(productId, variantId, quantity)` → `PATCH /api/v1/admin/products/:productId/variants/:variantId/stock`
  - [x] Estado: `AsyncValue<List<StockProduct>>`
- [x] Modelo `stock_item.dart`: `StockProduct { id, name, variants: List<StockVariant> }`, `StockVariant { id, size, color, stock }` (AC: 1)
- [x] Vista `StockManagementScreen` con layout de dos paneles (AC: 1, 2)
  - [x] Lista de productos con `ExpansionTile` por producto
  - [x] Dentro de cada tile: tabla de variantes (talle | color | stock | acción)
  - [x] Campo editable de stock con `TextEditingController` + botón "Guardar"
  - [x] Feedback visual: loading spinner por variante + mensaje de éxito/error (AC: 4)
- [x] Actualizar route placeholder creado en Story 8.1 con la vista real (AC: 1)

## Dev Notes

### BFF — Stock update endpoint
```typescript
// admin.routes.ts
router.patch('/products/:productId/variants/:variantId/stock', updateVariantStock)

// admin.controller.ts
export async function updateVariantStock(req: Request, res: Response) {
  const { productId, variantId } = req.params
  const { quantity } = req.body
  const userId = req.user!.id  // viene del authMiddleware

  await pool.query('BEGIN')
  try {
    const old = await pool.query('SELECT quantity FROM stock WHERE variant_id = $1', [variantId])
    await pool.query('UPDATE stock SET quantity = $1 WHERE variant_id = $2', [quantity, variantId])
    await pool.query(
      'INSERT INTO stock_adjustments (variant_id, user_id, old_quantity, new_quantity) VALUES ($1,$2,$3,$4)',
      [variantId, userId, old.rows[0].quantity, quantity]
    )
    await pool.query('COMMIT')
    return res.status(200).json({ data: { variantId: Number(variantId), newQuantity: quantity } })
  } catch (err) {
    await pool.query('ROLLBACK')
    throw err
  }
}
```

### Migración 039 — tabla stock_adjustments
```sql
CREATE TABLE stock_adjustments (
  id           SERIAL PRIMARY KEY,
  variant_id   INTEGER NOT NULL REFERENCES variants(id),
  user_id      INTEGER NOT NULL REFERENCES users(id),
  old_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  adjusted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stock_adjustments_variant ON stock_adjustments(variant_id);
CREATE INDEX idx_stock_adjustments_user    ON stock_adjustments(user_id);
```

### Flutter — Provider con Riverpod
```dart
// stock_provider.dart
final stockProductsProvider = StateNotifierProvider<StockNotifier, AsyncValue<List<StockProduct>>>(
  (ref) => StockNotifier(ref.read(_stockDioProvider)),
);

class StockNotifier extends StateNotifier<AsyncValue<List<StockProduct>>> {
  StockNotifier(this._dio) : super(const AsyncValue.loading()) {
    fetch();
  }
  Future<void> fetch() async { ... }
  Future<void> updateStock(int productId, int variantId, int quantity) async { ... }
}
```

### DioClient provider
Ver `lib/core/api/client.dart` — ya tiene `createDioClient()`. Crear un `dioClientProvider` o pasar via `ref.read` desde main.

### Layout Desktop recomendado
```dart
// StockManagementScreen — layout con barra superior y lista
Scaffold(
  appBar: AppBar(title: const Text('Gestión de Stock'), actions: [logoutButton]),
  body: Consumer(builder: (context, ref, _) {
    final state = ref.watch(stockProductsProvider);
    return state.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (products) => ListView.builder(
        itemCount: products.length,
        itemBuilder: (_, i) => ProductExpansionTile(product: products[i]),
      ),
    );
  }),
)
```

### Campo editable de stock por variante
```dart
// Usar un controller local por variante para edición
final _controller = TextEditingController(text: variant.stock.toString());

TextField(
  controller: _controller,
  keyboardType: TextInputType.number,
  decoration: const InputDecoration(labelText: 'Stock'),
)
FilledButton(
  onPressed: () => ref.read(stockProductsProvider.notifier)
    .updateStock(product.id, variant.id, int.parse(_controller.text)),
  child: const Text('Guardar'),
)
```

### Reutilizar GET /products
El endpoint `GET /api/v1/products?page=1&limit=100` ya existe y retorna productos con variantes incluyendo talle, color y stock. No crear nuevo endpoint, reutilizar el existente.

### Depende de
Story 8.1 (Desktop setup y login) debe estar done.

### Project Structure Notes
```
jedami-mobile/lib/features/stock/
  screens/stock_management_screen.dart   ← implementar aquí
  providers/stock_provider.dart          ← Riverpod state
  models/stock_item.dart                 ← StockProduct, StockVariant

jedami-bff/src/modules/admin/
  admin.controller.ts                    ← agregar updateVariantStock

jedami-bff/src/database/migrations/
  039_stock_adjustments.sql              ← nueva migración
```

### Referencias
- [Source: jedami-mobile/lib/features/products/providers/products_provider.dart] — patrón Riverpod existente
- [Source: jedami-mobile/lib/features/products/models/product.dart] — modelo existente de producto
- [Source: jedami-mobile/lib/core/api/client.dart] — Dio client
- [Source: jedami-bff/src/modules/admin/admin.controller.ts] — agregar handler
- [Source: jedami-bff/src/routes/admin.routes.ts] — registrar ruta

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- `Future.microtask(() {})` insuficiente para esperar fetch() async en tests → reemplazado por `pumpEventQueue()`
- Import `auth_provider.dart` en `stock_provider.dart` era unused (AuthInterceptor está en `client.dart`) → eliminado
- **[Code Review]** `pool.query('BEGIN')` no garantiza misma conexión → reemplazado por `pool.connect()` + `client.release()` en `finally`
- **[Code Review]** `json['size'] as String` y `json['color'] as String` lanzaban TypeError si API retorna null → cambiados a `(json['x'] as String?) ?? ''`
- **[Code Review]** Test `updateStock lanza excepción` usaba `expect(() => ..., throwsA(...))` sin await → `await expectLater(...)`

### Completion Notes List
- Migración numerada `039_` (no `020_` como indicaba la story) — el directorio ya tenía hasta `038_`
- `pageSize=200` en lugar de `limit=100` para alinearse con la paginación del BFF existente
- `_StockCell` implementado como `ConsumerStatefulWidget` con `TextEditingController` local, `didUpdateWidget` para sincronizar valores en refresh externo, y revert automático del campo en caso de error

### File List
- `jedami-bff/src/database/migrations/039_stock_adjustments.sql` (nuevo)
- `jedami-bff/src/modules/admin/admin.controller.ts` (modificado — added updateVariantStock)
- `jedami-bff/src/routes/admin.routes.ts` (modificado — added PATCH route)
- `jedami-mobile/lib/features/stock/models/stock_item.dart` (nuevo)
- `jedami-mobile/lib/features/stock/providers/stock_provider.dart` (nuevo)
- `jedami-mobile/lib/features/stock/screens/stock_management_screen.dart` (reemplazado placeholder)
- `jedami-mobile/test/features/stock/stock_notifier_test.dart` (nuevo — 9 unit tests)
