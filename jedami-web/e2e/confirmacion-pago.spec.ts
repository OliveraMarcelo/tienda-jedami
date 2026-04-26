import { test, expect } from '@playwright/test'

// Ruta real: /pedidos/:orderId/confirmacion?status=...
// Estos tests usan el storageState del admin (por defecto en chromium project)

const BFF = process.env.E2E_BFF_URL ?? 'http://localhost:3000/api/v1'

let retailOrderId: number | null = null

test.beforeAll(async () => {
  try {
    // Reponer stock antes de crear la orden
    const adminLogin = await fetch(`${BFF}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@jedami.com', password: 'admin123' }),
    })
    const { data: adminData } = await adminLogin.json()
    if (adminData?.token) {
      await fetch(`${BFF}/products/2/variants/14/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminData.token}` },
        body: JSON.stringify({ quantity: 50 }),
      })
    }

    const loginRes = await fetch(`${BFF}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e-retail@jedami.com', password: 'Test1234!' }),
    })
    const { data: loginData } = await loginRes.json()
    const token = loginData?.token
    if (!token) return

    const orderRes = await fetch(`${BFF}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: [{ variantId: 14, quantity: 1 }] }),
    })
    const { data: order } = await orderRes.json()
    retailOrderId = order?.id ?? null
  } catch {
    // Si falla la creación, los tests usarán un id ficticio (el status viene del query param)
  }
})

test.describe('Confirmación de Pago (/pedidos/:id/confirmacion)', () => {

  // ── CONF-001 ──────────────────────────────────────────────────────────────────
  test('CONF-001 | Redirect de MP llega a la página de confirmación', async ({ page }) => {
    const id = retailOrderId ?? 1
    await page.goto(`/pedidos/${id}/confirmacion?status=approved`)
    // La página carga y muestra algún h1 (según el status del query param)
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })

  // ── CONF-002 ──────────────────────────────────────────────────────────────────
  test('CONF-002 | Página muestra estado "Pagado" correctamente', async ({ page }) => {
    const id = retailOrderId ?? 1
    await page.goto(`/pedidos/${id}/confirmacion?status=approved`)
    await expect(page.getByRole('heading', { name: '¡Pago confirmado!' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Seguir comprando' })).toBeVisible()
  })

  // ── CONF-003 ──────────────────────────────────────────────────────────────────
  test('CONF-003 | Pago fallido muestra mensaje de error', async ({ page }) => {
    const id = retailOrderId ?? 1
    await page.goto(`/pedidos/${id}/confirmacion?status=rejected`)
    await expect(page.getByRole('heading', { name: 'Pago rechazado' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Reintentar pago' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ver mis pedidos' })).toBeVisible()
  })

  // ── CONF-004 ──────────────────────────────────────────────────────────────────
  test('CONF-004 | Botón "Ver pedido" lleva al detalle', async ({ page }) => {
    const id = retailOrderId ?? 1
    await page.goto(`/pedidos/${id}/confirmacion?status=pending`)
    await expect(page.getByRole('heading', { name: 'Pago en proceso' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Ver pedido' }).click()
    await expect(page).toHaveURL(new RegExp(`/pedidos/${id}$`), { timeout: 8_000 })
  })

  // ── CONF-005 ──────────────────────────────────────────────────────────────────
  test('CONF-005 | Botón "Volver al catálogo" funcional', async ({ page }) => {
    const id = retailOrderId ?? 1
    await page.goto(`/pedidos/${id}/confirmacion?status=approved`)
    await expect(page.getByRole('button', { name: 'Seguir comprando' })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'Seguir comprando' }).click()
    await expect(page).toHaveURL('/catalogo', { timeout: 8_000 })
  })

  // ── CONF-006 ──────────────────────────────────────────────────────────────────
  test('CONF-006 | Transferencia bancaria: pantalla de espera visible', async ({ page }) => {
    const id = retailOrderId ?? 1
    await page.goto(`/pedidos/${id}/confirmacion?status=pending`)
    await expect(page.getByRole('heading', { name: 'Pago en proceso' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Tu pago está siendo procesado/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ver pedido' })).toBeVisible()
  })

})
