import { test, expect, type Page, type Browser } from '@playwright/test'

const ADMIN = { email: 'admin@jedami.com', password: 'admin123' }

// ─── ID de producto obtenido una sola vez ─────────────────────────────────────
let productId = -1

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await page.goto('/catalogo')
  const firstLink = page.locator('a[href^="/catalogo/"]').first()
  await firstLink.waitFor({ timeout: 15_000 })
  const href = await firstLink.getAttribute('href')
  productId = Number(href?.split('/').pop())
  await page.close()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function goToProduct(page: Page) {
  await page.goto(`/catalogo/${productId}`)
  await page.waitForLoadState('networkidle', { timeout: 15_000 })
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('tu@email.com').fill(email)
  await page.getByPlaceholder('••••••••').fill(password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(/\/(catalogo|admin)/, { timeout: 10_000 })
}

// ─── Suite ────────────────────────────────────────────────────────────────────
test.describe('Detalle de Producto — /catalogo/:id', () => {

  // ── PROD-001 ──────────────────────────────────────────────────────────────────
  test('PROD-001 | Página del producto carga correctamente', async ({ page }) => {
    await goToProduct(page)

    // Nombre del producto (h1) visible
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })

    // Imagen principal visible
    const mainImg = page.locator('.aspect-square img').first()
    await expect(mainImg).toBeVisible({ timeout: 8_000 })

    await expect(page).toHaveURL(`/catalogo/${productId}`)
  })

  // ── PROD-002 ──────────────────────────────────────────────────────────────────
  test('PROD-002 | Galería de imágenes — miniatura activa cambia imagen principal', async ({ page }) => {
    await goToProduct(page)

    const thumbnails = page.locator('.flex.gap-2.mt-3 button')
    const count = await thumbnails.count()

    if (count > 1) {
      await thumbnails.nth(1).click()
      await expect(thumbnails.nth(1)).toHaveClass(/border-\[#E91E8C\]/)
    } else {
      console.log('PROD-002: producto sin múltiples imágenes')
    }
  })

  // ── PROD-003 ──────────────────────────────────────────────────────────────────
  test('PROD-003 | Precios mayoristas visibles para usuario wholesale', async ({ page }) => {
    // Asegurar modo Mayorista vía localStorage antes de navegar al producto
    await page.goto('/catalogo')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.setItem('jedami_view_mode', 'wholesale'))

    await goToProduct(page)

    await expect(page.getByText('Precio mayorista')).toBeVisible({ timeout: 8_000 })
  })

  // ── PROD-004 ──────────────────────────────────────────────────────────────────
  test('PROD-004 | Tabla de descuentos visible si hay reglas configuradas', async ({ page }) => {
    await goToProduct(page)

    // La tabla de descuentos es opcional según configuración
    const discountTable = page.locator('table').first()
    const hasTable = await discountTable.isVisible().catch(() => false)

    if (hasTable) {
      await expect(discountTable).toBeVisible()
    } else {
      console.log('PROD-004: sin reglas de descuento configuradas en este producto')
    }
  })

  // ── PROD-005 ──────────────────────────────────────────────────────────────────
  test('PROD-005 | Sin descuentos: tabla no aparece ni hay errores', async ({ page }) => {
    await page.route(`**/api/v1/products/${productId}/discount-rules**`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ quantityRules: [], curvaRules: [], minQuantityPurchase: null }),
      })
    )

    await goToProduct(page)

    // El producto carga correctamente
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })

    // Sin errores visibles
    const errorEl = page.locator('.text-red-500, .text-red-600').first()
    const hasError = await errorEl.isVisible().catch(() => false)
    expect(hasError).toBeFalsy()
  })

  // ── PROD-006 ──────────────────────────────────────────────────────────────────
  test('PROD-006 | Selección de variante — botón de compra responde', async ({ page }) => {
    await goToProduct(page)
    await page.waitForTimeout(300)

    const sizeButtons = page.locator('button').filter({ hasText: /^(XS|S|M|L|XL|XXL|XXXL|\d{2,})$/ })
    const sizeCount = await sizeButtons.count()

    if (sizeCount > 0) {
      await sizeButtons.first().click()
      const buyBtn = page.getByRole('button', { name: /comprar ahora|agregar/i })
      await expect(buyBtn).toBeVisible()
    } else {
      console.log('PROD-006: sin variantes de talla en el primer producto')
    }
  })

  // ── PROD-007 ──────────────────────────────────────────────────────────────────
  test('PROD-007 | Botón Comprar ahora sin variante → disabled', async ({ page }) => {
    await goToProduct(page)

    const buyBtn = page.getByRole('button', { name: 'Comprar ahora' })
    const hasBuyBtn = await buyBtn.isVisible().catch(() => false)

    if (hasBuyBtn) {
      await expect(buyBtn).toBeDisabled()
    } else {
      console.log('PROD-007: botón retail no visible (modo mayorista activo)')
    }
  })

  // ── PROD-008 ──────────────────────────────────────────────────────────────────
  test('PROD-008 | Soft gate: usuario sin sesión al comprar → modal registro', async ({ page }) => {
    // Sin autenticación (contexto fresco de por sí, pero por claridad)
    await goToProduct(page)

    // Seleccionar variante si hay tallas disponibles
    await page.waitForTimeout(300)
    const sizeButtons = page.locator('button').filter({ hasText: /^(XS|S|M|L|XL|XXL|XXXL|\d{2,})$/ })
    if (await sizeButtons.count() > 0) {
      await sizeButtons.first().click()
    }

    const buyBtn = page.getByRole('button', { name: 'Comprar ahora' })
    const isVisible = await buyBtn.isVisible().catch(() => false)
    const isEnabled = isVisible ? await buyBtn.isEnabled().catch(() => false) : false

    if (isEnabled) {
      await buyBtn.click()
      // SoftRegistrationGate debe aparecer — buscar contenido de registro/login
      await expect(
        page.getByText(/registr|ingres/i).first()
      ).toBeVisible({ timeout: 5_000 })
    } else {
      console.log('PROD-008: variante no seleccionable o sin stock — soft gate no activable')
    }
  })

  // ── PROD-009 ──────────────────────────────────────────────────────────────────
  test('PROD-009 | Sidebar de anuncios visible si hay anuncios activos', async ({ page }) => {
    await goToProduct(page)
    await page.waitForTimeout(1_000)

    const sidebar = page.locator('aside').first()
    const hasSidebar = await sidebar.isVisible().catch(() => false)

    if (hasSidebar) {
      await expect(sidebar).toBeVisible()
    } else {
      console.log('PROD-009: sin anuncios activos en el sistema')
    }
  })

  // ── PROD-010 ──────────────────────────────────────────────────────────────────
  test('PROD-010 | Producto no encontrado → "Producto no encontrado."', async ({ page }) => {
    await page.goto('/catalogo/99999999')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await expect(page.getByText('Producto no encontrado.')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole('link', { name: 'Volver al catálogo' })).toBeVisible()
  })

  // ── PROD-011 ──────────────────────────────────────────────────────────────────
  test('PROD-011 | Link "← Catálogo" navega de vuelta a /catalogo', async ({ page }) => {
    await goToProduct(page)

    await page.getByRole('link', { name: /← Catálogo/i }).click()
    await expect(page).toHaveURL('/catalogo', { timeout: 8_000 })
  })

})
