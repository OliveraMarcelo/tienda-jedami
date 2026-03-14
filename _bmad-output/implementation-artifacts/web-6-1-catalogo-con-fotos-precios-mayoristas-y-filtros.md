# Story web-6.1: Catálogo con Fotos, Precios Mayoristas y Filtros (WEB)

Status: done

## Story

Como comprador (minorista o mayorista),
quiero ver el catálogo con fotos reales de los productos, filtrar por categoría, y ver precios diferenciados según mi tipo de cuenta,
para que la experiencia de compra sea visualmente atractiva y relevante para mi perfil.

**Depende de:** Stories 6.1, 6.3, 6.4 done

## Acceptance Criteria

1. **Given** el comprador abre el catálogo
   **Then** cada ProductCard muestra la foto principal del producto (o un placeholder si no hay)
   **And** se muestra el badge de categoría en la esquina inferior derecha de la imagen

2. **Given** hay categorías disponibles en la API
   **Then** se muestra una fila de pills horizontales: "Todas" + una por categoría
   **And** el pill activo se resalta en rosa (`#E91E8C`)
   **When** el comprador hace click en un pill
   **Then** el catálogo se recarga mostrando solo productos de esa categoría

3. **Given** el comprador está en modo mayorista
   **Then** cada ProductCard muestra "Precio mayorista" con el menor `wholesalePrice` de las variantes
   **And** si una variante no tiene `wholesalePrice`, se usa `retailPrice` como fallback

4. **Given** el comprador abre el detalle de un producto con múltiples fotos
   **Then** se muestra la imagen principal en grande
   **And** se muestran miniaturas debajo para navegar entre las imágenes

5. **Given** el admin abre "Crear producto" o "Editar producto"
   **Then** puede seleccionar una categoría del dropdown
   **And** puede agregar/eliminar fotos ingresando URLs

6. **Given** el admin abre "Agregar variante"
   **Then** puede ingresar `wholesalePrice` además de `retailPrice`

## Tasks

- [x] `types/api.ts`: `Variant.wholesalePrice`, `Product.categoryId/categoryName/imageUrl/images[]`, `Category`
- [x] `api/products.api.ts`: `fetchProducts(page, pageSize, categoryId?)`, `fetchCategories()`
- [x] `stores/products.store.ts`: `categories`, `selectedCategoryId`, `filterByCategory()`, `loadCategories()`
- [x] `ProductCard.vue`: imagen real, badge categoría, precio mayorista con fallback
- [x] `CatalogView.vue`: pills de filtro, `loadCategories()` en `onMounted`
- [x] `ProductView.vue`: galería con imagen principal + miniaturas
- [x] `api/admin.api.ts`: `categoryId` en create/update, `addImage()`, `deleteImage()`, `wholesalePrice` en variante
- [x] `ProductFormDialog.vue`: selector de categoría + gestión de fotos (agregar/eliminar URL)
- [x] `VariantFormDialog.vue`: campo `wholesalePrice`
- [x] `admin.products.store.ts`: `addImage()`, `deleteImage()`
