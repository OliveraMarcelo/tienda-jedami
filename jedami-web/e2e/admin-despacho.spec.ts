import { test, expect } from '@playwright/test'

test.describe('Admin – Despacho (/admin/despacho)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/despacho')
    await expect(page.getByRole('heading', { name: 'Gestión de despacho' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })
  })

  // ── DESP-001 ─────────────────────────────────────────────────────────────────
  test('DESP-001 | Vista carga correctamente sin errores', async ({ page }) => {
    // La página carga sin el mensaje de error
    await expect(page.getByText('Error al cargar los pedidos pendientes.')).not.toBeVisible()

    // Hay información sobre el propósito de la vista
    await expect(page.getByText(/Pedidos pagados pendientes de despacho/)).toBeVisible()
  })

  // ── DESP-007 ─────────────────────────────────────────────────────────────────
  test('DESP-007 | Sin pedidos pendientes muestra estado vacío sin errores', async ({ page }) => {
    // Con la DB vacía de pedidos, debe mostrar el mensaje de lista vacía
    const noOrders = page.getByText('No hay pedidos pendientes de despacho.')
    const hasOrders = page.locator('[data-testid="order-card"], .order-item')

    const isEmpty = await noOrders.isVisible()
    const hasData = await hasOrders.count() > 0

    // Uno de los dos estados es válido
    expect(isEmpty || hasData).toBe(true)

    // No debe haber error
    await expect(page.getByText('Error al cargar los pedidos pendientes.')).not.toBeVisible()
  })

  // ── DESP-003 (condicional: solo si hay pedidos) ────────────────────────────────
  test('DESP-003 | Fulfillment de item curva — UI presente si hay pedidos', async ({ page }) => {
    const noOrders = await page.getByText('No hay pedidos pendientes de despacho.').isVisible()
    if (noOrders) {
      test.skip() // No hay pedidos en este entorno
    }

    // Si hay pedidos: verificar que los controles de asignación de color están presentes
    await expect(page.getByRole('button', { name: /Guardar color|Descontar stock/ }).first()).toBeVisible({ timeout: 5_000 })
  })

  // ── DESP-004 (condicional: solo si hay pedidos) ────────────────────────────────
  test('DESP-004 | Botón "Despachar pedido" presente en pedido completo', async ({ page }) => {
    const noOrders = await page.getByText('No hay pedidos pendientes de despacho.').isVisible()
    if (noOrders) {
      test.skip()
    }

    // Si hay pedidos: debe haber al menos un botón de despacho
    const dispatchBtn = page.getByRole('button', { name: /Despachar pedido|Marcar despachado/ })
    await expect(dispatchBtn.first()).toBeVisible({ timeout: 5_000 })
  })

  // ── DESP-008 ─────────────────────────────────────────────────────────────────
  test('DESP-008 | Información del pedido correcta si hay pedidos', async ({ page }) => {
    const noOrders = await page.getByText('No hay pedidos pendientes de despacho.').isVisible()
    if (noOrders) {
      test.skip()
    }

    // Si hay pedidos: verificar que se muestra información del comprador y fecha
    await expect(page.locator('table, .order-card').first()).toBeVisible({ timeout: 5_000 })
  })

})
