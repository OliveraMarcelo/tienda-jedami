import { test, expect } from '@playwright/test'

const EMPTY = 'No hay pedidos pagados para despachar.'

test.describe('Admin – Despacho (/admin/despacho)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/despacho')
    await expect(page.getByRole('heading', { name: 'Despacho' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.animate-pulse').first()).not.toBeVisible({ timeout: 10_000 })
  })

  // ── DESP-001 ─────────────────────────────────────────────────────────────────
  test('DESP-001 | Vista carga correctamente sin errores', async ({ page }) => {
    await expect(page.getByText('Error al cargar los pedidos para despachar.')).not.toBeVisible()
    await expect(page.getByText(/Pedidos pagados, del más viejo al más nuevo/)).toBeVisible()
  })

  // ── DESP-007 ─────────────────────────────────────────────────────────────────
  test('DESP-007 | Muestra pedidos o el estado vacío, sin errores', async ({ page }) => {
    const isEmpty = await page.getByText(EMPTY).isVisible()
    const hasOrders = await page.locator('article').count() > 0
    expect(isEmpty || hasOrders).toBe(true)
    await expect(page.getByText('Error al cargar los pedidos para despachar.')).not.toBeVisible()
  })

  // ── DESP-003 (condicional: solo si hay pedidos) ────────────────────────────────
  test('DESP-003 | Curva/cantidad: grilla talle × color opcional, sin sugerencia automática', async ({ page }) => {
    const grid = page.locator('article').filter({ has: page.locator('table') }).first()
    if (await grid.count() === 0) test.skip() // no hay pedidos por curva o cantidad en este entorno

    await expect(grid.getByRole('button', { name: 'Sugerir reparto' })).toHaveCount(0)
    // Sin cargar colores igual se puede despachar: el stock no se descuenta
    await expect(grid.getByText(/Sin reparto/)).toBeVisible()
    await expect(grid.getByRole('button', { name: 'Confirmar despacho' })).toBeEnabled()
  })

  // ── DESP-004 (condicional: solo si hay pedidos) ────────────────────────────────
  test('DESP-004 | Cada pedido tiene su botón "Confirmar despacho"', async ({ page }) => {
    if (await page.getByText(EMPTY).isVisible()) test.skip()
    const orders = await page.locator('article').count()
    await expect(page.getByRole('button', { name: 'Confirmar despacho' })).toHaveCount(orders)
  })

  // ── DESP-008 ─────────────────────────────────────────────────────────────────
  test('DESP-008 | Información del pedido si hay pedidos', async ({ page }) => {
    if (await page.getByText(EMPTY).isVisible()) test.skip()
    await expect(page.locator('article header').first()).toContainText(/Pedido #\d+/)
  })

  // ── DESP-002 ─────────────────────────────────────────────────────────────────
  test('DESP-002 | Notas del comprador visibles en el pedido', async () => {
    // Omitido: requiere un pedido con nota específica del comprador en la DB
    test.skip()
  })

  // ── DESP-005 ─────────────────────────────────────────────────────────────────
  test('DESP-005 | Confirmar despacho descuenta el stock', async () => {
    // Omitido: modifica stock permanentemente; requiere un pedido pagado específico
    test.skip()
  })

})
