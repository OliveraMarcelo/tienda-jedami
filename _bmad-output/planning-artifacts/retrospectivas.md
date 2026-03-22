# Retrospectivas — Tienda Jedami

**Proyecto:** tienda-jedami
**Autor:** Marceloo
**Fecha de cierre:** 2026-03-15
**Épicas cubiertas:** 1 → 7 (Épica 8 en backlog)

---

## Épica 1: Gestión del Catálogo de Productos

**Objetivo:** Infraestructura base, auth/roles, CRUD de productos con variantes y catálogo público funcional.
**Tracks:** BFF (5 stories) · Web (4 stories) · Mobile (2 stories)
**Estado final:** ✅ Done

### ✅ Qué funcionó bien

- **Monorepo desde el día uno.** Establecer la estructura `jedami-bff / jedami-web / jedami-mobile` con un Makefile raíz facilitó el desarrollo multi-servicio sin rozamientos. La separación fue limpia y nunca necesitó revisarse.
- **Decisión de remover TypeORM y adoptar SQL puro.** Aunque implicó refactorizar las entidades a interfaces planas y reescribir las queries, la ganancia en control, legibilidad y velocidad de iteración justificó el costo temprano. Las queries en `modules/<nombre>/queries/*.ts` resultaron fáciles de leer, testear en psql y mantener.
- **RBAC con middleware.** El patrón `authMiddleware + requireRole([ROLES.ADMIN])` como middleware componible fue elegante y consistente. Se replicó sin fricciones en todas las épicas posteriores.
- **Arquitectura en capas (controller → service → repository).** Las capas fueron respetadas en todas las épicas. Nunca se necesitó refactorizar la separación de responsabilidades.
- **BMAD adoptado como framework de trabajo.** Las stories con Dev Notes y AC bien definidos redujeron la ambigüedad y la vuelta atrás durante el desarrollo.

### ⚠️ Qué fue difícil

- **La migración TypeORM → SQL puro fue costosa en el momento.** Se realizó durante la épica en curso, no en un momento de calma. En proyectos futuros, decidir el stack de persistencia antes de escribir la primera línea de dominio.
- **El esquema de variantes no contempló el soft delete.** La tabla `variants` se diseñó con `DELETE` físico, sin considerar que `order_items` tendría FK activas. Esto causó un error crítico de constraint en la Épica 7 al intentar eliminar variantes desde el panel admin. Se resolvió con la migración `022_variants_soft_delete.sql` (`active BOOLEAN DEFAULT TRUE`), pero hubiera sido más limpio desde el inicio.
- **El setup del proyecto Flutter (Mobile)** requirió ajustes de plataforma (`-d chrome` como default en dev) por ausencia del Android SDK en el entorno local.

### 🎯 Decisiones de diseño tomadas

| Decisión | Razonamiento |
|---|---|
| SQL puro con `pg` Pool, sin ORM | Control total de queries, sin magia de ORM, queries legibles y versionables |
| Separación `users` / `customers` | `users` = cuenta de autenticación; `customers` = perfil comercial con `customer_type`. Permite que un usuario tenga múltiples roles sin contaminar la identidad comercial |
| Monorepo con Makefile raíz | Un solo punto de entrada para todos los servicios |
| Errores RFC 7807 `{type, title, status, detail}` | Consistencia en todos los endpoints |
| JWT 24h, bcrypt salt ≥ 10 | Balance entre seguridad y experiencia (refresh tokens llegaron en Épica 5) |

### 📚 Lecciones aprendidas

1. **Diseñar el esquema pensando en la integridad referencial desde el inicio.** `active BOOLEAN` en tablas con FKs activas debería ser un patrón por defecto.
2. **Fijar el stack de infraestructura (ORM vs. SQL puro) antes de escribir código de dominio.** Cambiar a mitad de sprint tiene costo alto.

### 🔧 Deuda técnica generada

- Soft delete de variantes fue parchado en Épica 7; idealmente debería haberse diseñado en Épica 1.
- No hay tests automatizados — deuda histórica que sigue en pie.

---

## Épica 2: Compra Mayorista

**Objetivo:** Registro de comprador mayorista, creación de pedidos en modalidades curva y cantidad, validación atómica de stock.
**Tracks:** BFF (5 stories) · Web (3 stories)
**Estado final:** ✅ Done

### ✅ Qué funcionó bien

- **Validación de stock atómica en transacción.** El uso de `BEGIN / COMMIT / ROLLBACK` para la secuencia `validar stock → descontar → crear pedido` resultó robusto. Nunca se reportaron inconsistencias de stock durante el desarrollo.
- **Precio histórico en `order_items.unit_price`.** Guardar el precio al momento de la compra (copia de `product_prices`) fue una decisión de integridad de datos que evitó problemas futuros ante cambios de precio. Se implementó bien desde el inicio.
- **Separación de modalidades (curva vs. cantidad) encapsulada.** La lógica de cada modalidad quedó en su propia función de servicio, siguiendo el principio de responsabilidad única. Agregar nuevas modalidades en el futuro no requeriría tocar el core de pedidos.
- **`purchase_type` como campo del pedido (no como tabla FK).** El código de modalidad se guarda como string en `orders.purchase_type`, lo que simplifica las queries sin sacrificar legibilidad.

### ⚠️ Qué fue difícil

- **La lógica de curva es inherentemente compleja.** Una "curva" = 1 unidad de cada variante activa × N curvas. La validación de stock por variante individual + la distribución del pedido requirieron varios ciclos de ajuste.
- **El componente `CurvaCalculator.vue` necesitó ser rediseñado en Épica 7.** La implementación original mostraba el stock disponible en la tabla, lo que no era correcto para la experiencia del comprador mayorista (no debería ver el stock interno). También mostraba filas por variante en lugar de la matriz Talle × Color. Este rediseño debería haberse especificado mejor en el story original.

### 🎯 Decisiones de diseño tomadas

| Decisión | Razonamiento |
|---|---|
| `customers` separado de `users` | Perfil comercial independiente de la cuenta de auth |
| Precio histórico en `order_items` | Inmutabilidad ante cambios futuros de precio |
| Stock validado en transacción BFF | Sin condiciones de carrera en compras simultáneas |
| `purchase_type` como string en `orders` | Legible, simple, extensible |

### 📚 Lecciones aprendidas

1. **Especificar con más detalle la UX del componente de compra por curva desde el story.** Las tablas de variantes tienen una UX propia que merece AC explícitos.
2. **Mostrar al comprador lo que necesita, no los datos internos del sistema.** El stock disponible es un detalle operacional, no información que el cliente necesita para comprar.

### 🔧 Deuda técnica generada

- `CurvaCalculator.vue` fue rediseñado en Épica 7 (corrección tardía).
- No hay endpoint para cancelar pedidos en estado `pending`.

---

## Épica 3: Pagos con Mercado Pago (Mayoristas)

**Objetivo:** El mayorista puede pagar sus pedidos mediante Mercado Pago; el webhook actualiza el estado automáticamente.
**Tracks:** BFF (2 stories) · Web (1 story)
**Estado final:** ✅ Done

### ✅ Qué funcionó bien

- **Integración limpia con el MCP de Mercado Pago.** El MCP configurado en Claude Code permitió explorar la documentación y validar los payloads directamente durante el desarrollo, reduciendo las iteraciones de ensayo y error.
- **Seguridad del webhook con verificación de firma HMAC.** El uso de `MP_WEBHOOK_SECRET` para validar requests del webhook impide que terceros falsifiquen notificaciones de pago.
- **Diseño desacoplado del sistema de pagos.** El módulo `payments` es independiente del módulo `orders`. Una notificación de pago actualiza el estado del pedido vía servicio, sin acoplamiento directo.
- **Épica corta y bien acotada.** 3 stories claras → entrega rápida.

### ⚠️ Qué fue difícil

- **El entorno de pruebas de MP requiere usuarios de test específicos.** Crear compradores y vendedores de test tiene pasos extra que no están documentados en el flujo normal.
- **El webhook requiere una URL pública accesible desde Internet.** En desarrollo local es necesario usar un túnel (ngrok, etc.), lo que agrega fricción.

### 🎯 Decisiones de diseño tomadas

| Decisión | Razonamiento |
|---|---|
| Registro histórico de cada pago en tabla `payments` | Auditoría completa; permite reintento ante webhook doble |
| Verificación de firma HMAC en webhook | Seguridad ante requests forjados |
| Credenciales MP en `.env` (nunca commiteadas) | Separación de secretos del código |

### 📚 Lecciones aprendidas

1. **Preparar el entorno de test de MP desde el inicio de la épica**, no al momento de probar el webhook.
2. **Idempotencia en el webhook es crítica.** Si MP envía la notificación dos veces, el sistema no debería duplicar el estado del pedido.

### 🔧 Deuda técnica generada

- Idempotencia del webhook no está explícitamente validada (si llega dos veces `approved`, el pedido se marca dos veces como `paid` — sin daño pero sin control).
- No hay mecanismo de reintento manual desde el panel admin ante pagos fallidos.

---

## Épica 4: Compra Minorista con Pago

**Objetivo:** Un comprador minorista puede registrarse, comprar por variante+cantidad y pagar con Mercado Pago.
**Tracks:** BFF (3 stories) · Web (2 stories)
**Estado final:** ✅ Done

### ✅ Qué funcionó bien

- **Reutilización de patrones de Épica 2 y 3.** La compra minorista es una versión simplificada de la mayorista: mismos módulos, mismas validaciones de stock, mismo flujo de pago. La deuda de diseño de las épicas anteriores se cobró dividendo aquí.
- **Épica entregada rápidamente.** Al tener la infraestructura de pedidos y pagos ya construida, solo se necesitó parametrizar el flujo para el rol `retail`.
- **Soft gate de registro.** El comprador minorista puede ver el catálogo sin cuenta; solo necesita registrarse para comprar. UX progresiva bien implementada.

### ⚠️ Qué fue difícil

- **Distinguir la lógica de validación de stock minorista vs. mayorista.** El minorista valida la suma de stock de TODAS las variantes del producto (no por variante individual), mientras que el mayorista valida por variante. Esta distinción fue fuente de confusión en los primeros drafts de los stories.

### 🎯 Decisiones de diseño tomadas

| Decisión | Razonamiento |
|---|---|
| Reutilizar módulo `payments` sin modificación | El flujo de pago es idéntico para mayorista y minorista |
| Validación de stock por suma total de variantes | El minorista elige "N unidades del producto X", no una variante específica |
| Soft gate en el catálogo web | Mejor experiencia: primero navegar, luego registrarse |

### 📚 Lecciones aprendidas

1. **Documentar explícitamente la diferencia entre validación de stock mayorista y minorista en el PRD.** La sutileza (por variante vs. suma total) no era evidente en la documentación inicial.

### 🔧 Deuda técnica generada

- No hay selección explícita de variante en la compra minorista por cantidad (se distribuye automáticamente). Podría necesitar UI más granular en el futuro.

---

## Épica 5: Escalabilidad y Operación

**Objetivo:** Redis cache activo, rate limiting y refresh tokens para soportar carga real.
**Track:** BFF (3 stories)
**Estado final:** ✅ Done

### ✅ Qué funcionó bien

- **Redis cache en el catálogo.** Las queries de catálogo (con joins a variantes, precios, imágenes) son costosas. El caché con TTL configurable eliminó la carga en la DB para las rutas más consultadas.
- **Rate limiting con `express-rate-limit`.** Implementado en minutos; protege contra abusos sin complejidad operacional.
- **Refresh tokens.** Mejoran la experiencia del usuario (sesiones más largas) sin sacrificar la seguridad del access token corto.
- **Invalidación de caché consistente.** Todas las mutaciones de productos llaman `cacheDel` — el patrón fue respetado en Épica 6 y 7.

### ⚠️ Qué fue difícil

- **La épica fue marcada `done` relativamente rápido** — no hubo grandes fricciones técnicas.
- **El endpoint `GET /config` no fue cacheado** aunque fue identificado como candidato. En Épica 7 se detectó que las mutaciones de config (tipos de compra, etc.) tampoco invalidaban caché porque no había caché que invalidar. No hubo bug real, pero la inconsistencia de diseño generó confusión.

### 🎯 Decisiones de diseño tomadas

| Decisión | Razonamiento |
|---|---|
| Cache key por `catalog:page:X:size:Y:cat:Z` | Granularidad suficiente para invalidar por producto sin barrer todo |
| `cacheDel(CATALOG_KEY)` en toda mutación de productos | Consistencia garantizada, trade-off: invalidación algo agresiva |
| TTL configurable via `ENV.CACHE_TTL` | Permite ajustar en producción sin cambios de código |

### 📚 Lecciones aprendidas

1. **Decidir desde el diseño qué endpoints se cachean.** Si el endpoint de config se hubiera cacheado, las mutaciones de Épica 7 habrían necesitado invalidación desde el inicio.
2. **Documentar la estrategia de caché en la arquitectura** para que futuros desarrolladores sepan qué invalidar al agregar mutaciones.

### 🔧 Deuda técnica generada

- No se implementó el bus de eventos en tiempo real (RNF-07 — diferido a Fase F).
- El endpoint `GET /config` no está cacheado; si se agrega caché en el futuro, las mutaciones de Épica 7 deberán actualizarse para invalidarlo.

---

## Épica 6: Catálogo Mejorado — Fotos, Categorías, Precios y Configuración

**Objetivo:** Imágenes de productos, categorías, precios mayoristas diferenciados, tablas de referencia normalizadas y eliminación del hardcoding.
**Tracks:** BFF (5 stories) · Web (2 stories)
**Estado final:** ✅ Done

### ✅ Qué funcionó bien

- **Sistema de tablas de configuración (`purchase_types`, `customer_types`, `sizes`, `colors`, `price_modes`, `categories`, `branding`).** Eliminar los valores hardcodeados del código y moverlos a la DB fue un salto de madurez importante. El endpoint `GET /config` se convirtió en el contrato central del frontend.
- **`config.store.ts` en Pinia** como single source of truth para toda la configuración de la app. Los computed maps (`purchaseTypeLabel`, `customerTypeLabel`) simplificaron los templates.
- **Multer con patrón factory (`makeUpload(dest)`).** La refactorización a función factory permitió reutilizar la lógica de upload para productos y, más tarde, para branding (Épica 7) sin duplicar código.
- **Separación DDL de seed data en migraciones.** Corrección aplicada tras feedback del usuario: los archivos `NNN_seed_*.sql` contienen datos de prueba separados de los `NNN_*.sql` que solo hacen DDL. El resultado es una historia de migraciones más limpia.
- **`product_images` con posición y URL.** El modelo permite múltiples imágenes por producto ordenadas, con la primera imagen usada como thumbnail en el catálogo.

### ⚠️ Qué fue difícil

- **La épica fue la más amplia en número de tablas nuevas** (9 tablas de configuración/referencia). El modelo de datos creció significativamente y el orden de las migraciones requirió cuidado para respetar las FKs.
- **El precio mayorista por producto (no por variante)** fue una decisión de diseño no obvia. Se eligió tabla `product_prices` con `price_mode_id` (FK a `price_modes`) en lugar de precio por variante, lo que simplifica la gestión pero limita la granularidad de precios a futuro.
- **La corrección de separar DDL de seed** llegó como feedback tardío; parte del seed ya estaba mezclado con DDL en commits anteriores.

### 🎯 Decisiones de diseño tomadas

| Decisión | Razonamiento |
|---|---|
| `product_prices` con `price_mode_id` (no precio por variante) | Simplicidad de gestión; el admin fija un precio por producto, no por variante |
| Una sola fila en `branding` (id=1) | La tienda tiene un único branding; UPDATE siempre afecta id=1 |
| `GET /config` público, mutaciones admin-only | El frontend necesita config sin auth; las mutaciones deben estar protegidas |
| Seed en archivos separados de DDL | Migraciones DDL son idempotentes en producción; seeds no deben correr en prod |

### 📚 Lecciones aprendidas

1. **Separar DDL de seed data desde el primer archivo de migración.** No mezclarlos es una convención que ahorra confusión al desplegar en producción.
2. **Definir desde el inicio si los precios son por producto o por variante.** Cambiar esto en producción sería una migración costosa.
3. **Un endpoint público de configuración es un patrón potente** que reduce hardcoding en todos los clientes (web, mobile) simultáneamente.

### 🔧 Deuda técnica generada

- Los precios son por producto (`product_prices`), no por variante. Si en el futuro se necesitan precios diferenciados por talle o color, será una migración de modelo.
- No hay endpoint para reordenar imágenes de producto desde la UI.

---

## Épica 7: Panel de Administración Avanzado y Branding

**Objetivo:** Dashboard de ventas con métricas y gráficos, tabla de pagos, gestión de usuarios enriquecida, branding dinámico y CRUD de tablas de configuración desde el panel admin.
**Tracks:** BFF (3 stories) · Web (3 stories)
**Estado final:** ✅ Done (post code review)

### ✅ Qué funcionó bien

- **Dashboard con Chart.js.** Los gráficos de torta (pedidos por estado) y barras (pedidos por tipo) se integaron con `vue-chartjs` de forma limpia. El registro de componentes de Chart.js en el scope del componente (no global) fue la elección correcta.
- **Branding dinámico desde la DB.** La decisión de almacenar el branding en una tabla `branding` (id=1) en lugar de variables de entorno resultó en un sistema de configuración en tiempo real. El admin puede cambiar el nombre, colores y logo de la tienda sin tocar código ni reiniciar el BFF.
- **`watchEffect` en App.vue para CSS variables.** Aplicar `--color-primary` y `--color-secondary` vía `watchEffect` garantiza reactividad total: al guardar el branding desde AdminConfigView, los colores de la UI cambian instantáneamente sin recargar.
- **Subida de logo como archivo local** (igual que imágenes de productos), usando la factory `makeUpload(UPLOADS_BRANDING_DIR)`. Consistente con el patrón existente.
- **Soft delete de variantes** (`active BOOLEAN`). El bug de FK al eliminar variantes se resolvió con una migración simple y el filtro `AND v.active = TRUE` en los JOINs. La historia de pedidos queda íntegra.

### ⚠️ Qué fue difícil

- **Bug crítico descubierto en code review: `loadConfig()` no re-fetcheaba tras mutaciones.** El guard `if (loaded.value) return` evitaba el re-fetch cuando `AdminConfigView` llamaba `loadConfig()` después de agregar/modificar tipos de compra. Se resolvió exponiendo `refreshConfig()` sin guard en el store.
- **Errores silenciosos en mutaciones de AdminConfigView.** Los `try/catch` de todos los handlers de mutación tragaban excepciones sin mostrar feedback al usuario. Fue detectado en el code review y corregido con refs de error por sección.
- **Story drift en W7.2.** El AC-3 especificaba "logo en lugar del nombre". Durante el desarrollo el usuario pidió explícitamente mostrar ambos (logo + nombre). El story no se actualizó hasta el code review. La incoherencia story/código es un riesgo para mantenimiento futuro.
- **FK violation al eliminar variantes** — bug latente desde Épica 1, no detectado hasta implementar "Eliminar variante" en el panel admin.
- **Colores hardcodeados en Chart.js.** `#E91E8C` estaba hardcodeado en la config del gráfico de barras. Chart.js no soporta CSS variables; la solución fue leer `configStore.branding.primaryColor` directamente al construir el dataset.

### 🎯 Decisiones de diseño tomadas

| Decisión | Razonamiento |
|---|---|
| Branding en DB (no en ENV) | El admin puede editarlo sin acceso al servidor; hot-reload real |
| `watchEffect` para CSS vars (no `onMounted`) | Reactividad total: el cambio de branding desde admin se aplica al instante |
| Logo + nombre siempre visibles en header | Decisión de UX del cliente: identidad visual doble |
| Tabs manuales con Tailwind (no shadcn Tabs) | shadcn Tabs no estaba instalado; implementación custom es más liviana |
| Soft delete con `active = FALSE` para variantes | Preserva la integridad de `order_items` sin eliminar datos históricos |
| `refreshConfig()` separado de `loadConfig()` | `loadConfig()` tiene guard para la carga inicial; `refreshConfig()` es para invalidaciones explícitas |

### 📚 Lecciones aprendidas

1. **El guard de cache en stores de Pinia es un anti-patrón para datos mutables.** `if (loaded.value) return` está pensado para la inicialización, no para invalidación. Exponer `refreshConfig()` desde el inicio habría evitado el bug.
2. **Error handling en mutaciones es obligatorio, no opcional.** Sin feedback visual de errores, el admin no sabe si la operación falló. Todo handler de mutación debe tener un ref de error y mostrarlo.
3. **Actualizar el story file cuando el usuario cambia un AC en tiempo real.** El drift entre story y código es deuda de documentación que confunde revisiones futuras.
4. **El code review adversarial vale la pena.** 7 hallazgos, 2 críticos, todos corregibles en la misma sesión. Sin el review, el bug de `loadConfig()` hubiera sido invisible hasta que un admin agregara un nuevo tipo de compra y se preguntara por qué el dashboard no lo mostraba.

### 🔧 Deuda técnica generada

- No hay paginación en la tabla de pedidos recientes del dashboard (muestra los últimos 10 hardcodeados en la query).
- AdminUsersView permite asignar roles inline pero no hay confirmación de acción destructiva.
- No hay soft delete para sizes/colors (DELETE físico con FK guard en el BFF).

---

## Retrospectiva General del Proyecto

### Evolución del stack

| Momento | Decisión |
|---|---|
| Inicio | TypeORM + Express |
| Épica 1 (mid) | Migración a SQL puro con `pg` Pool |
| Épica 5 | Redis cache + rate limiting + refresh tokens |
| Épica 6 | Multer uploads + config store centralizado |
| Épica 7 | Soft delete variants + branding dinámico |

### Patrones que emergieron y se consolidaron

- **`modules/<nombre>/queries/*.ts`** — queries como constantes exportadas, naming descriptivo. Se adoptó en todas las épicas.
- **`controller → service → repository`** — capas respetadas consistentemente.
- **`{ data }` wrapper en todas las respuestas** + camelCase desde el BFF.
- **`AppError(status, title, type, detail)`** — errores RFC 7807 uniformes.
- **Pinia stores por dominio** (`auth.store`, `config.store`, `products.store`, etc.) con acciones asíncronas y estado reactivo.
- **Skeleton de carga con `animate-pulse`** — UX consistente en todas las vistas admin.

### Decisiones que no cambiaríamos

- SQL puro sobre ORM para este dominio.
- Separación `users` / `customers`.
- Precio histórico en `order_items`.
- Config dinámica en DB (no en ENV).
- BMAD como framework de stories.

### Decisiones que haríamos diferente

- Soft delete para variantes desde Épica 1.
- `refreshConfig()` expuesto desde el primer story de config store.
- Seed data separado de DDL desde el primer archivo de migración.
- AC de UX de componentes complejos (CurvaCalculator) con mayor detalle.
- Actualización de story files cada vez que un AC cambia durante el desarrollo.

### Métricas del proyecto

| Indicador | Valor |
|---|---|
| Épicas completadas | 7 de 8 (Épica 8 en backlog) |
| BFF stories | ~25 done |
| Web stories | ~15 done |
| Mobile stories | 2 done |
| Migraciones SQL | ~22 archivos |
| Bugs encontrados en code review Épica 7 | 7 (2 críticos, 3 medianos, 2 menores) |
| Bugs resueltos en la misma sesión de review | 7 (100%) |
