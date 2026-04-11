# Story web-17.1: Selector de Medio de Pago en Checkout

Status: done

Depende de: `17-1-multiples-medios-pago-por-tipo-cliente` (done)

## Contexto

Una vez que el BFF puede retornar `{ type: 'select', options: [...] }` cuando hay múltiples gateways activos para el `customer_type` del usuario, el frontend debe mostrar un selector para que el comprador elija el medio de pago antes de continuar el checkout.

También se requiere una vista de configuración en el panel admin para habilitar/deshabilitar gateways por tipo de cliente.

## Story

Como comprador (minorista o mayorista),
quiero ver y elegir entre los medios de pago disponibles para mi tipo de cuenta,
para pagar de la forma que me resulte más conveniente.

Como administrador,
quiero configurar desde el panel qué medios de pago están disponibles para cada tipo de cliente,
para controlar la experiencia de pago sin intervención técnica.

## Acceptance Criteria

1. **Given** el BFF retorna `{ type: 'select', options: ['checkout_pro', 'bank_transfer'] }`
   **When** el comprador llega al paso de pago
   **Then** el frontend muestra un selector con las opciones disponibles con label e ícono para cada una

2. **Given** el comprador selecciona un medio de pago
   **When** confirma la selección
   **Then** el frontend llama a `POST /payments/checkout` con `{ orderId, selectedGateway }` y continúa el flujo correspondiente (redirect, Brick embebido o datos bancarios)

3. **Given** el BFF retorna directamente `{ type: 'redirect' | 'preference' | 'bank_transfer' }` (un solo gateway activo)
   **When** el comprador llega al paso de pago
   **Then** el flujo continúa sin mostrar el selector (comportamiento actual)

4. **Given** el administrador abre la sección de medios de pago en el panel de configuración
   **When** carga la vista
   **Then** ve una tabla con todos los gateways disponibles × tipos de cliente, con toggles de activo/inactivo

5. **Given** el admin cambia el estado de un gateway para un tipo de cliente
   **When** guarda el cambio
   **Then** el frontend llama a `PATCH /config/payment-gateways` y actualiza la UI sin recargar la página

## Tasks / Subtasks

### Task 1 — Store Pinia: extensión de `usePaymentStore` o nuevo `useCheckoutStore`
- [x] Acción `initiateCheckout(orderId)`: llama `POST /payments/checkout`, maneja las tres respuestas posibles (`select` | `redirect` | `preference` | `bank_transfer`)
- [x] Acción `selectGateway(orderId, gateway)`: llama `POST /payments/checkout` con `selectedGateway`
- [x] State: `pendingSelection: boolean`, `availableGateways: string[]`

### Task 2 — Componente `PaymentMethodSelector.vue`
- [x] Renderiza tarjetas o botones para cada gateway disponible
- [x] Labels e íconos por gateway:
  - `checkout_pro` → "Tarjeta / MercadoPago" + ícono MP
  - `checkout_api` → "Tarjeta de crédito/débito" + ícono tarjeta
  - `bank_transfer` → "Transferencia bancaria" + ícono banco
  - `mp_point` → "Pago presencial (Point)" + ícono POS
- [x] Al seleccionar, emite evento `gateway-selected` con el valor

### Task 3 — Integración en el flujo de checkout
- [x] En la vista/componente de checkout, cuando `useCheckoutStore.pendingSelection === true`, montar `PaymentMethodSelector.vue`
- [x] Al recibir `gateway-selected`, llamar `selectGateway(orderId, gateway)` y continuar el flujo según la respuesta del BFF

### Task 4 — Vista admin: configuración de medios de pago
- [x] Nueva sección en `AdminConfigView.vue` o nueva ruta `/admin/config/payment-gateways`
- [x] Tabla con filas por gateway, columnas por tipo de cliente (retail / wholesale), toggles por celda
- [x] Al cambiar un toggle, llamar `PATCH /config/payment-gateways` con `{ customer_type, gateway, active }`
- [x] Feedback visual (toast) de éxito o error

### Task 5 — Configuración inicial en `useConfigStore`
- [x] Al cargar `GET /config`, mapear `paymentGatewayRules` al store
- [x] Exponer getter `getGatewaysForCustomerType(type)` para uso en componentes

## Dev Notes

### Sin mocks
El frontend solo se implementa cuando `17-1` está done y la API real está disponible.

### Compatibilidad con flujo actual
Si el BFF retorna directamente `{ type: 'redirect' | 'preference' | 'bank_transfer' }`, el flujo existente no cambia. El selector solo aparece cuando `type === 'select'`.

### Labels de gateways
Centralizar los labels e íconos en un mapa constante (`GATEWAY_LABELS`) en un archivo de utilidades para evitar duplicación entre `PaymentMethodSelector.vue` y la vista de configuración admin.

### Referencias
- [Depende de: `17-1-multiples-medios-pago-por-tipo-cliente.md`]
- [Source: jedami-web/src/stores/]
- [Source: jedami-web/src/views/checkout/]
- [Source: jedami-web/src/views/admin/]

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- `props` declared but unused en `PaymentMethodSelector.vue` → cambiado a `defineProps` sin asignar variable
- Pre-existing ESLint `any` en `OrderDetailView.vue` (SDK de MercadoPago sin tipos TS) — 5 errores pre-existentes, no introducidos

### Completion Notes List
- `GATEWAY_LABELS` centralizado en `jedami-web/src/lib/gateway-labels.ts` — compartido por `PaymentMethodSelector.vue` y la tabla admin
- `usePaymentsStore` extendido con: `pendingSelection`, `availableGateways`, `pendingOrderId`, `bankDetails`, `checkoutPublicKey`, `initiateSmartCheckout`, `selectGateway`, `resetCheckoutState`
- `startCheckout` (legacy) se conserva para compatibilidad
- `OrderDetailView.vue` refactorizado: eliminado el check `configStore.config.paymentGateway` para decidir flujo; ahora usa un único botón "Pagar" → `initiateSmartCheckout`; brick montado via `watch` en `checkoutPublicKey`
- Eliminado el auto-trigger de `bank_transfer` en `onMounted` — ahora el usuario inicia el flujo con el botón "Pagar"
- Tabla admin en `AdminConfigView.vue` tab Pagos: filas = gateways, columnas = retail/wholesale, toggles con feedback inline
- `AppConfig.paymentGatewayRules` añadido a la interfaz; `config.store.ts` expone `paymentGatewayRules` computed y `getGatewaysForCustomerType()`

### File List
- `jedami-web/src/lib/gateway-labels.ts` (nuevo)
- `jedami-web/src/components/features/checkout/PaymentMethodSelector.vue` (nuevo)
- `jedami-web/src/api/payments.api.ts` (modificado — `SmartCheckoutResult` + `smartCheckout()`)
- `jedami-web/src/stores/payments.store.ts` (modificado — smart checkout state + actions)
- `jedami-web/src/api/config.api.ts` (modificado — `PaymentGatewayRuleItem` + `paymentGatewayRules` en `AppConfig`)
- `jedami-web/src/stores/config.store.ts` (modificado — `paymentGatewayRules` computed + `getGatewaysForCustomerType`)
- `jedami-web/src/api/admin.config.api.ts` (modificado — `fetchPaymentGatewayRules` + `patchPaymentGatewayRule`)
- `jedami-web/src/views/OrderDetailView.vue` (modificado — integración smart checkout + PaymentMethodSelector)
- `jedami-web/src/views/admin/AdminConfigView.vue` (modificado — tabla gateway rules por tipo de cliente)

---

## Bug Fixes Post-Implementación

### Bug 1: Tab "Pagos" en AdminConfigView no se podía navegar (crash de render)

**Problema:** `loadPaymentGatewayRules()` no tenía bloque `catch`. Si la API fallaba, el error propagaba al `Promise.all` de `onMounted` y el componente quedaba en estado inválido. Además, cuando la tabla `payment_gateway_rules` estaba vacía, el backend retornaba `{}` (sin claves `retail`/`wholesale`), sobreescribiendo el valor inicial `{ retail: [], wholesale: [] }`. Al activar el tab "Pagos", `isGatewayActive` llamaba `.find()` sobre `undefined` (TypeError) y Vue crasheaba el render del componente.

**Fixes:**
- `isGatewayActive` — agregado `?? []`: `const rules = pgRules.value[customerType] ?? []`
- `loadPaymentGatewayRules` — agregado catch: `catch { pgRulesError.value = 'Error al cargar los medios de pago' }`
- `fetchPaymentGatewayRules` en `admin.config.api.ts` — normaliza la respuesta garantizando siempre ambas claves:
  ```typescript
  return { retail: data.retail ?? [], wholesale: data.wholesale ?? [] }
  ```

**Archivos:** `jedami-web/src/views/admin/AdminConfigView.vue`, `jedami-web/src/api/admin.config.api.ts`

---

### Bug 2: Error "Error al actualizar" en toggle de gateway (tabla vacía)

**Problema:** Al tener la tabla `payment_gateway_rules` vacía, `fetchPaymentGatewayRules` retornaba `{}` y `pgRules.value` quedaba sin las claves `retail`/`wholesale`. Al hacer toggle, `toggleGatewayRule` ejecutaba `pgRules.value[customerType].findIndex(...)` sobre `undefined` (TypeError). El catch lo capturaba como `'Error al actualizar'` aunque el backend había respondido 200 con el registro creado.

**Fix:** `fetchPaymentGatewayRules` normaliza la respuesta (ver Bug 1) — con `retail: data.retail ?? []` y `wholesale: data.wholesale ?? []`, `findIndex` siempre opera sobre un array.

**Archivo:** `jedami-web/src/api/admin.config.api.ts`

---

### Bug 3: Botón "Pagar" desaparece al cancelar CardPaymentBrick (OrderDetailView)

**Problema:** Al cancelar el brick, los botones "Cancelar" solo seteaban `brickVisible = false` pero no limpiaban `paymentsStore.checkoutPublicKey`. La condición del botón "Pagar" es `!bankDetails && !checkoutPublicKey && !brickVisible` — con `checkoutPublicKey` seteada, la condición daba false y el botón desaparecía permanentemente hasta recargar la página. Los artículos del pedido seguían visibles pero el usuario no podía retomar el pago.

**Fix:** Ambos botones "Cancelar" (en el área de total y en el brick) ahora llaman `paymentsStore.resetCheckoutState()`:
```html
@click="brickVisible = false; brickError = ''; paymentsStore.resetCheckoutState()"
```

**Archivo:** `jedami-web/src/views/OrderDetailView.vue`

---

### Bug 4: "Ver datos de transferencia" aparece para todos los clientes en Mis Pedidos (OrdersView)

**Problema:** `OrdersView.vue` usaba `configStore.config.paymentGateway === 'bank_transfer'` (el gateway global del branding) para decidir qué botón de pago mostrar. Si el admin configuraba el gateway global como `bank_transfer`, **todos** los pedidos mostraban "Ver datos de transferencia" independientemente del tipo de cliente o de las reglas de `payment_gateway_rules`. Esta lógica era incompatible con el sistema multi-gateway de la story 17-1.

**Fix:** Se reemplazó la lógica de 3 ramas (`bank_transfer` / `checkout_pro` / `checkout_api`) por un único botón **"Pagar"** que llama a `smartCheckout` del backend:
- `redirect` → redirige a MP
- `bank_transfer` → muestra datos bancarios inline (mantiene el mismo UX)
- `select` o `preference` → navega a `/pedidos/{id}` (OrderDetailView tiene el UI completo)

También se eliminó el código del CardPaymentBrick inline en OrdersView (era duplicación innecesaria; el brick vive únicamente en OrderDetailView).

**Archivos:** `jedami-web/src/views/OrdersView.vue` (refactor del bloque de pago + eliminación del brick inline + remoción de imports de `usePaymentsStore`, `processPayment`, `nextTick`)
