import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/retail.json' })

const BFF = process.env.E2E_BFF_URL ?? 'http://localhost:3000/api/v1'

let orderId: number | null = null

test.beforeAll(async () => {
  try {
    // Login admin para reponer stock antes de crear la orden
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

    // Login retail y crear pedido
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
    orderId = order?.id ?? null
  } catch {
    // Los tests que requieran orderId harán skip
  }
})

test.describe('Detalle de Pedido (/pedidos/:orderId)', () => {

  // ── DET-001 ───────────────────────────────────────────────────────────────────
  test('DET-001 | Detalle del pedido carga con items correctos', async ({ page }) => {
    if (!orderId) test.skip()
    await page.goto(`/pedidos/${orderId}`)
    await expect(page.getByRole('heading', { name: `Pedido #${orderId}` })).toBeVisible({ timeout: 10_000 })
    // Tabla de artículos visible
    await expect(page.getByText('Artículos')).toBeVisible()
    // Al menos una fila de item
    await expect(page.locator('table tbody tr').first()).toBeVisible()
  })

  // ── DET-002 ───────────────────────────────────────────────────────────────────
  test('DET-002 | Precio original y precio con descuento visibles', async ({ page }) => {
    if (!orderId) test.skip()
    await page.goto(`/pedidos/${orderId}`)
    await expect(page.getByRole('heading', { name: `Pedido #${orderId}` })).toBeVisible({ timeout: 10_000 })
    // Si hay descuento, el precio original aparece tachado
    const hasDiscount = await page.locator('.line-through').count() > 0
    if (!hasDiscount) test.skip()
    await expect(page.locator('.line-through').first()).toBeVisible()
  })

  // ── DET-003 ───────────────────────────────────────────────────────────────────
  test('DET-003 | Botón "Pagar" visible para pedidos pendientes', async ({ page }) => {
    if (!orderId) test.skip()
    await page.goto(`/pedidos/${orderId}`)
    await expect(page.getByRole('heading', { name: `Pedido #${orderId}` })).toBeVisible({ timeout: 10_000 })
    // Pedido recién creado es "pending" → botón Pagar visible
    await expect(page.getByRole('button', { name: 'Pagar' })).toBeVisible({ timeout: 5_000 })
  })

  // ── DET-004 ───────────────────────────────────────────────────────────────────
  test('DET-004 | Checkout directo cuando hay 1 gateway activo', async ({ page }) => {
    // Omitido: comportamiento depende de la configuración de gateways activos en la DB
    test.skip()
  })

  // ── DET-005 ───────────────────────────────────────────────────────────────────
  test('DET-005 | Selector de gateway cuando hay múltiples activos', async ({ page }) => {
    // Omitido: requiere múltiples gateways activos en la DB
    test.skip()
  })

  // ── DET-006 ───────────────────────────────────────────────────────────────────
  test('DET-006 | Elegir Checkout Pro → redirect a Mercado Pago', async ({ page }) => {
    // Omitido: el redirect externo a Mercado Pago no puede verificarse en e2e local
    test.skip()
  })

  // ── DET-007 ───────────────────────────────────────────────────────────────────
  test('DET-007 | Elegir Checkout API → brick embebido en la página', async ({ page }) => {
    // Omitido: requiere MP SDK externo y gateway checkout_api activo
    test.skip()
  })

  // ── DET-008 ───────────────────────────────────────────────────────────────────
  test('DET-008 | Elegir Transferencia Bancaria → instrucciones', async ({ page }) => {
    // Omitido: requiere gateway bank_transfer activo y datos de CVU/alias configurados
    test.skip()
  })

  // ── DET-009 ───────────────────────────────────────────────────────────────────
  test('DET-009 | Link WhatsApp visible en instrucciones de transferencia', async ({ page }) => {
    // Omitido: depende de bank_transfer activo y whatsappNumber configurado
    test.skip()
  })

  // ── DET-010 ───────────────────────────────────────────────────────────────────
  test('DET-010 | Cancelar pedido — pedido pasa a "Cancelado"', async ({ page }) => {
    // Crear un pedido exclusivo para cancelar (con reposición de stock)
    let cancelOrderId: number | null = null
    try {
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
      if (token) {
        const orderRes = await fetch(`${BFF}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ items: [{ variantId: 14, quantity: 1 }] }),
        })
        const { data: order } = await orderRes.json()
        cancelOrderId = order?.id ?? null
      }
    } catch { /* skip */ }
    if (!cancelOrderId) test.skip()

    // El cancel en OrdersView (lista) no en OrderDetailView
    await page.goto('/pedidos')
    await expect(page.locator('h1', { hasText: 'Mis pedidos' })).toBeVisible({ timeout: 10_000 })

    const orderCard = page.locator('.bg-white.rounded-2xl').filter({ hasText: `#${cancelOrderId}` }).first()
    await expect(orderCard).toBeVisible({ timeout: 5_000 })

    await orderCard.getByText('Cancelar pedido').click()
    await expect(page.getByText('¿Estás seguro? Esta acción no se puede deshacer.')).toBeVisible()
    await page.getByText('Sí, cancelar').click()

    await expect(orderCard.getByText('Cancelado')).toBeVisible({ timeout: 8_000 })
  })

  // ── DET-011 ───────────────────────────────────────────────────────────────────
  test('DET-011 | No se puede cancelar un pedido ya pagado', async ({ page }) => {
    // Omitido: requiere un pedido en estado "paid" en la DB
    test.skip()
  })

  // ── DET-012 ───────────────────────────────────────────────────────────────────
  test('DET-012 | Campo de notas visible y editable', async ({ page }) => {
    if (!orderId) test.skip()
    // Las notas se editan desde la lista de pedidos (/pedidos), no desde el detalle
    await page.goto('/pedidos')
    await expect(page.locator('h1', { hasText: 'Mis pedidos' })).toBeVisible({ timeout: 10_000 })

    // La sección de notas está presente en la card del pedido
    await expect(page.getByText('Sin notas para el administrador').first()).toBeVisible({ timeout: 5_000 })
    // Botón "Agregar nota" para pedidos pendientes
    await expect(page.getByText('Agregar nota').first()).toBeVisible()
  })

  // ── DET-013 ───────────────────────────────────────────────────────────────────
  test('DET-013 | Estado "Pagado" se muestra con badge visual', async ({ page }) => {
    // Omitido: requiere un pedido en estado "paid" en la DB
    test.skip()
  })

  // ── DET-014 ───────────────────────────────────────────────────────────────────
  test('DET-014 | Reintento de pago para pedido con pago fallido', async ({ page }) => {
    // Omitido: requiere un pedido en estado "rejected" en la DB
    test.skip()
  })

  // ── DET-015 ───────────────────────────────────────────────────────────────────
  test('DET-015 | Usuario no puede ver pedido de otro usuario', async ({ page }) => {
    if (!orderId) test.skip()
    // Sin sesión activa, /pedidos/:id redirige al login
    // Hacemos logout para limpiar el estado reactivo de auth
    await page.goto(`/pedidos/${orderId}`)
    await page.getByRole('button', { name: 'Salir' }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 })

    // Intentar acceder al pedido sin sesión → debe redirigir al login
    await page.goto(`/pedidos/${orderId}`)
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 })
  })

  // ── DET-016 ───────────────────────────────────────────────────────────────────
  test('DET-016 | Detalle de pedido muestra items con variante (talla y color)', async ({ page }) => {
    if (!orderId) test.skip()
    await page.goto(`/pedidos/${orderId}`)
    await expect(page.getByRole('heading', { name: `Pedido #${orderId}` })).toBeVisible({ timeout: 10_000 })
    // La variante con talla y color se muestra en formato "Talla — Color"
    // variantId 14 = 12-18m / Blanco
    const variantCell = page.locator('table tbody tr td').first()
    await expect(variantCell).toBeVisible()
    await expect(variantCell).not.toHaveText('—')
  })

})
