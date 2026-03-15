# Story W1.3: Catálogo Público — ProductCard + VariantSelector + StockMatrix

Status: done

## Story

Como visitante o comprador,
quiero ver el catálogo de productos con sus variantes, precios y estados de stock,
para que pueda explorar la oferta y decidir qué comprar.

**Depende de:** BFF Stories 1.4 + 1.5 done (`GET /api/v1/products` y `GET /api/v1/products/:id` operativos)

## Acceptance Criteria

1. **Given** el usuario entra a `/catalogo`
   **When** la API retorna productos con variantes
   **Then** se muestra una grilla responsive: 4 cols desktop / 3 cols tablet / 2 cols mobile
   **And** cada `ProductCard` muestra: nombre, precio, swatches de color inline, badge de disponibilidad general

2. **Given** el usuario hace hover sobre una `ProductCard`
   **When** la card tiene imagen definida
   **Then** la imagen hace swap (hover image swap: mostrar misma imagen levemente escalada o un color background si no hay segunda imagen)

3. **Given** el usuario hace click en una card
   **When** entra a `/catalogo/:id`
   **Then** ve: nombre, descripción, galería placeholder, `VariantSelector` con todos los colores y talles, `StockMatrix`

4. **Given** una variante tiene `stock.quantity = 0`
   **When** se muestra en el `VariantSelector`
   **Then** el botón de talle aparece tachado (line-through), opacidad reducida y `aria-disabled="true"`

5. **Given** `authStore.mode === 'wholesale'`
   **When** se muestra el precio en cualquier card o detalle
   **Then** el label dice "Precio mayorista" en lugar de "Precio"
   **And** el `ModeIndicator` en el header muestra "🏭 Mayorista"

6. **Given** la página tiene más productos que `pageSize`
   **When** el usuario hace click en "Cargar más"
   **Then** se agregan los siguientes productos a la grilla (no se reemplaza la página entera)

7. **Given** la API está cargando
   **When** el usuario espera la respuesta
   **Then** se muestran skeleton cards animadas (nunca un spinner bloqueante de página)

## Tasks / Subtasks

- [ ] Task 1 — Crear `src/api/products.api.ts` (AC: #1, #6)
  - [ ] `fetchProducts(page, pageSize)`: GET `/products?page=N&pageSize=20` → retorna `{ data: Product[], meta: { page, pageSize, total } }`
  - [ ] `fetchProduct(id)`: GET `/products/:id` → retorna `{ data: ProductWithVariants }`
  - [ ] Tipos TypeScript: `Product`, `Variant`, `ProductWithVariants`

- [ ] Task 2 — Crear `src/stores/products.store.ts` (AC: #1, #6)
  - [ ] Estado: `products: Product[]`, `currentProduct: ProductWithVariants | null`, `loading`, `page`, `total`
  - [ ] Acción `fetchCatalog(reset?)`: carga página siguiente o reinicia; append a la lista existente
  - [ ] Acción `fetchProduct(id)`: carga detalle del producto

- [ ] Task 3 — Crear `ProductCard.vue` (AC: #1, #2, #5)
  - [ ] Props: `product: Product`, `mode: 'retail' | 'wholesale'`
  - [ ] Hover image swap: `@mouseenter`/`@mouseleave` con transición CSS `transition-transform duration-200`
  - [ ] Swatches de color: pills de 16px por cada color único entre las variantes
  - [ ] Badge de stock: "Sin stock" si todas las variantes tienen quantity=0; "Últimas unidades" si alguna tiene quantity ≤ 3
  - [ ] Precio: `v-if mode === 'wholesale'` label "Precio mayorista", si no "Precio" (en Fase 1 mismo valor)
  - [ ] `rounded-2xl`, `gap-6`, aspect ratio `3/4` en imagen (con `bg-gray-100` placeholder si no hay imagen)

- [ ] Task 4 — Crear `VariantSelector.vue` (AC: #3, #4)
  - [ ] Props: `variants: Variant[]`, `selectedColor: string | null`, `selectedSize: string | null`
  - [ ] Emits: `update:selectedColor`, `update:selectedSize`
  - [ ] Paso 1: selector de color — swatches clickeables
  - [ ] Paso 2: selector de talle — filtrado por color seleccionado; talles agotados con `line-through opacity-50 cursor-not-allowed` y `aria-disabled="true"`
  - [ ] Texto reactivo: "X disponibles" debajo del selector de talle

- [ ] Task 5 — Crear `StockMatrix.vue` (AC: #3)
  - [ ] Props: `variants: Variant[]`
  - [ ] Tabla con headers de talle (columnas) y colores (filas)
  - [ ] Celda con `quantity`: verde si > 3, naranja si 1–3, rojo si 0
  - [ ] Texto + color siempre (nunca solo color — accesibilidad WCAG)
  - [ ] Leyenda: "● Disponible · ● Últimas unidades · ● Sin stock"

- [ ] Task 6 — Crear `CatalogView.vue` (AC: #1, #6, #7)
  - [ ] Grid responsive con clases Tailwind: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6`
  - [ ] Skeleton loaders: 8 cards placeholder con `animate-pulse bg-gray-200 rounded-2xl`
  - [ ] Botón "Cargar más": visible si `products.length < total`; llama `productsStore.fetchCatalog()`

- [ ] Task 7 — Crear `ProductView.vue` (AC: #3, #4, #5)
  - [ ] Layout: imagen grande (placeholder) + datos a la derecha en desktop, apilado en mobile
  - [ ] Integra `VariantSelector` + `StockMatrix`
  - [ ] Botón "Comprar" / "Agregar al pedido" según modo — deshabilitado si no hay variante seleccionada o sin stock
  - [ ] Si visitante sin auth → click en "Comprar" dispara `SoftRegistrationGate` (Sheet) — implementado en W1.2

## Dev Notes

### Endpoints del BFF a consumir

```
GET /api/v1/products?page=1&pageSize=20
  Response 200: {
    data: [{ id, name, description, variants: [{ id, size, color, retailPrice, stock: { quantity } }] }],
    meta: { page, pageSize, total }
  }
  Sin autenticación — ruta pública

GET /api/v1/products/:id
  Response 200: { data: { id, name, description, variants: [...] } }
  Error 404 RFC 7807: { type, title, status: 404, detail: "..." }
  Sin autenticación — ruta pública
```

### Tipos TypeScript

```typescript
// src/types/api.ts
export interface Variant {
  id: number
  size: string
  color: string
  retailPrice: number
  stock: { quantity: number }
}

export interface Product {
  id: number
  name: string
  description: string | null
  variants: Variant[]
}
```

### Lógica de swatches y colores únicos

```typescript
// En ProductCard o en un composable:
const uniqueColors = computed(() =>
  [...new Set(props.product.variants.map(v => v.color))]
)

const availableSizes = computed(() =>
  props.product.variants
    .filter(v => v.color === selectedColor.value)
    .map(v => ({ size: v.size, inStock: v.stock.quantity > 0 }))
)
```

### Badge de stock — lógica

```typescript
const stockBadge = computed(() => {
  const allVariants = props.product.variants
  const totalStock = allVariants.reduce((sum, v) => sum + v.stock.quantity, 0)
  if (totalStock === 0) return { text: 'Sin stock', class: 'bg-brand-error' }
  if (allVariants.some(v => v.stock.quantity > 0 && v.stock.quantity <= 3))
    return { text: 'Últimas unidades', class: 'bg-brand-warning' }
  return null  // sin badge si hay stock normal
})
```

### Grid responsive

```html
<!-- CatalogView.vue -->
<div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6">
  <ProductCard v-for="product in products" :key="product.id" :product="product" :mode="authStore.mode" />
  <!-- Skeletons mientras carga -->
  <template v-if="loading">
    <div v-for="n in 8" :key="`sk-${n}`"
         class="rounded-2xl bg-gray-200 animate-pulse aspect-[3/4]" />
  </template>
</div>
```

### Project Structure Notes

```
jedami-web/src/
├── api/
│   └── products.api.ts                              (NUEVO)
├── stores/
│   └── products.store.ts                            (NUEVO)
├── components/
│   └── features/
│       └── catalog/
│           ├── ModeIndicator.vue                    (ya existe de W1.1)
│           ├── ProductCard.vue                      (NUEVO)
│           ├── VariantSelector.vue                  (NUEVO)
│           └── StockMatrix.vue                      (NUEVO)
├── views/
│   ├── CatalogView.vue                              (NUEVO)
│   └── ProductView.vue                              (NUEVO)
└── types/
    └── api.ts                                       (NUEVO o extender si existe)
```

### References

- BFF stories 1.4 + 1.5: [Source: _bmad-output/implementation-artifacts/1-4-crud-de-productos-con-variantes.md] y [Source: _bmad-output/implementation-artifacts/1-5-catalogo-publico-de-productos.md]
- UX Design Spec — ProductCard, VariantSelector, StockMatrix: [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Custom Components]
- UX Design Spec — Grid catálogo, hover swap, breakpoints: [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive Design]
- UX Design Spec — J0 (visitante explora catálogo): [Source: _bmad-output/planning-artifacts/ux-design-specification.md#User Journey Flows]
- UX Design Spec — Feedback patterns (skeleton loaders): [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: products.api.ts con fetchProducts/fetchProduct tipados.
- Task 2: products.store.ts con append de páginas, loading, total.
- Task 3: ProductCard.vue con hover scale, color swatches como pills CSS, badge de stock, precio con label retail/wholesale.
- Task 4: VariantSelector.vue con selector de color (circles) y talle filtrado por color, line-through para agotados, aria-disabled.
- Task 5: StockMatrix.vue refactorizado a tabla Talle×Color (filas=talles ordenados por sizeId, columnas=colores) con fila de Total de stock. Formato limpio con colores semánticos inline, sin badges.
- Task 6: CatalogView.vue con grid responsive 2/3/4 cols, skeletons animate-pulse, botón "Cargar más".
- Task 7: ProductView.vue con layout imagen+datos, VariantSelector integrado, botón deshabilitado si sin stock. StockMatrix removido de ProductView (innecesario para el flujo de compra).
- Task 8 (nuevo): ModeIndicator convertido en botón clickeable que emite `toggle`. `authStore` expone `viewMode` (persistido en localStorage) y `toggleMode()`. Al login se inicializa según rol; al logout se resetea. AppLayout conecta el toggle.

### File List

- `jedami-web/src/types/api.ts` (NUEVO — Variant, Product, PaginationMeta)
- `jedami-web/src/api/products.api.ts` (NUEVO)
- `jedami-web/src/stores/products.store.ts` (NUEVO)
- `jedami-web/src/components/features/catalog/ProductCard.vue` (NUEVO)
- `jedami-web/src/components/features/catalog/VariantSelector.vue` (NUEVO)
- `jedami-web/src/components/features/catalog/StockMatrix.vue` (NUEVO)
- `jedami-web/src/views/CatalogView.vue` (MODIFICADO — implementación completa)
- `jedami-web/src/views/ProductView.vue` (MODIFICADO — implementación completa)
