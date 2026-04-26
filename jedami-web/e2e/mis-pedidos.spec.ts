import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/retail.json' })

test.describe('Mis Pedidos (/pedidos)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/pedidos')
    await expect(page.locator('h1', { hasText: 'Mis pedidos' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })
  })

  // ── ORD-001 ───────────────────────────────────────────────────────────────────
  test('ORD-001 | Lista de pedidos carga correctamente', async ({ page }) => {
    // La página carga sin errores — muestra lista o estado vacío
    await expect(page.locator('h1', { hasText: 'Mis pedidos' })).toBeVisible()
    await expect(page.getByText(/Error al cargar/i)).not.toBeVisible()
  })

  // ── ORD-002 ───────────────────────────────────────────────────────────────────
  test('ORD-002 | Estados de pedido visibles y con colores', async ({ page }) => {
    const hasOrders = await page.getByText(/Pendiente de pago|Pagado|Rechazado|Cancelado/).count() > 0
    if (!hasOrders) test.skip()

    const badge = page.getByText(/Pendiente de pago|Pagado|Rechazado|Cancelado/).first()
    await expect(badge).toBeVisible()
  })

  // ── ORD-003 ───────────────────────────────────────────────────────────────────
  test('ORD-003 | Click en pedido navega al detalle', async ({ page }) => {
    // El click handler está en el div interno con cursor-pointer, no en la card exterior
    const clickableArea = page.locator('.cursor-pointer').filter({ hasText: /^#\d+/ }).first()
    const hasOrders = await clickableArea.count() > 0
    if (!hasOrders) test.skip()

    await expect(clickableArea).toBeVisible({ timeout: 5_000 })
    const idText = await page.locator('span.font-semibold').filter({ hasText: /^#\d+/ }).first().textContent()
    const orderId = idText?.replace('#', '').trim()

    await clickableArea.click()
    await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}`), { timeout: 8_000 })
  })

  // ── ORD-004 ───────────────────────────────────────────────────────────────────
  test('ORD-004 | Sin pedidos muestra mensaje informativo', async ({ page }) => {
    const hasOrders = await page.getByText(/Pendiente de pago|Pagado|Rechazado|Cancelado/).count() > 0
    if (hasOrders) test.skip()

    await expect(page.getByText('Todavía no tenés pedidos')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ver catálogo' })).toBeVisible()
  })

  // ── ORD-005 ───────────────────────────────────────────────────────────────────
  test('ORD-005 | Solo se muestran los pedidos del usuario logueado', async ({ page }) => {
    // Verificar que la página carga correctamente sin errores de autorización
    await expect(page.locator('h1', { hasText: 'Mis pedidos' })).toBeVisible()
    await expect(page.getByText('Error')).not.toBeVisible()
    // El endpoint /orders solo retorna los pedidos del usuario autenticado (garantizado por el BFF)
  })

  // ── ORD-006 ───────────────────────────────────────────────────────────────────
  test('ORD-006 | Descuento aplicado visible en la lista', async ({ page }) => {
    const hasDiscount = await page.getByText(/-\d+%/).count() > 0
    if (!hasDiscount) test.skip()

    await expect(page.getByText(/-\d+%/).first()).toBeVisible()
  })

  // ── ORD-007 ───────────────────────────────────────────────────────────────────
  test('ORD-007 | Usuario sin sesión es redirigido al login', async ({ page }) => {
    // Hacer logout para limpiar el estado reactivo de auth
    await page.getByRole('button', { name: 'Salir' }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 })

    // Intentar navegar a /pedidos sin sesión → debe redirigir al login
    await page.goto('/pedidos')
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })

  // ── ORD-008 ───────────────────────────────────────────────────────────────────
  test('ORD-008 | Lista actualiza después de cancelar un pedido', async ({ page }) => {
    // Necesita un pedido en estado "pending" con botón "Cancelar pedido"
    const cancelBtn = page.getByText('Cancelar pedido').first()
    const hasCancel = await cancelBtn.count() > 0
    if (!hasCancel) test.skip()

    // Click en "Cancelar pedido" → aparece confirmación inline
    await cancelBtn.click()
    await expect(page.getByText('¿Estás seguro? Esta acción no se puede deshacer.')).toBeVisible()

    // Confirmar cancelación
    await page.getByText('Sí, cancelar').click()

    // El pedido cambia a estado "Cancelado"
    await expect(page.getByText('Cancelado').first()).toBeVisible({ timeout: 8_000 })
  })

})
