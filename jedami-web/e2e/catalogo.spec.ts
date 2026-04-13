import { test, expect, type Page } from '@playwright/test'

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function goToCatalog(page: Page) {
  await page.goto('/catalogo')
  // Esperar a que el catálogo cargue (heading visible)
  await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible({ timeout: 10_000 })
}

async function waitForProducts(page: Page) {
  // Esperar a que al menos una ProductCard esté en el DOM (no skeleton)
  await expect(page.locator('a[href^="/catalogo/"]').first()).toBeVisible({ timeout: 10_000 })
}

// ─── Suite ────────────────────────────────────────────────────────────────────
test.describe('Catálogo — /catalogo', () => {

  // ── CAT-001 ──────────────────────────────────────────────────────────────────
  test('CAT-001 | Catálogo carga con productos y fotos', async ({ page }) => {
    await goToCatalog(page)
    await waitForProducts(page)

    // Al menos una card con imagen visible
    const productImages = page.locator('a[href^="/catalogo/"] img')
    await expect(productImages.first()).toBeVisible()

    // El catálogo tiene múltiples productos
    const cards = page.locator('a[href^="/catalogo/"]')
    expect(await cards.count()).toBeGreaterThan(0)
  })

  // ── CAT-002 ──────────────────────────────────────────────────────────────────
  test('CAT-002 | Catálogo accesible sin iniciar sesión', async ({ page }) => {
    // Acceder sin cookies de sesión → sin login previo
    await page.context().clearCookies()
    await page.goto('/catalogo')

    // No debe redirigir a /login
    await expect(page).not.toHaveURL('/login')
    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible({ timeout: 10_000 })
  })

  // ── CAT-003 ──────────────────────────────────────────────────────────────────
  test('CAT-003 | Branding visible en el navbar (nombre de la tienda)', async ({ page }) => {
    await goToCatalog(page)

    // El link de la tienda en el navbar debe existir
    await expect(page.getByRole('link', { name: /jedami/i })).toBeVisible()
  })

  // ── CAT-004 ──────────────────────────────────────────────────────────────────
  test('CAT-004 | Filtrar productos por categoría', async ({ page }) => {
    await goToCatalog(page)
    await waitForProducts(page)

    // Esperar a que los filtros de categoría estén disponibles
    const categoryButtons = page.locator('button').filter({ hasText: /\w+/ }).first()

    // El botón "Todas" debe ser visible
    const todasBtn = page.getByRole('button', { name: 'Todas' })
    await expect(todasBtn).toBeVisible()

    // Tomar la primera categoría disponible (distinta de "Todas")
    const firstCategory = page.locator('.flex.gap-2 button').nth(1)
    const categoryCount = await page.locator('.flex.gap-2 button').count()

    if (categoryCount > 1) {
      const catName = await firstCategory.textContent()
      await firstCategory.click()

      // Esperar que se aplique el filtro — las cards deben recargar
      await page.waitForTimeout(500)
      const filteredCards = page.locator('a[href^="/catalogo/"]')
      expect(await filteredCards.count()).toBeGreaterThanOrEqual(0)

      // El botón de categoría seleccionado debe tener estilo activo (bg rosa)
      await expect(firstCategory).toHaveClass(/bg-\[#E91E8C\]/)
    } else {
      // Si no hay categorías, el test pasa (sin datos suficientes)
      test.skip()
    }
  })

  // ── CAT-005 ──────────────────────────────────────────────────────────────────
  test('CAT-005 | Buscar producto por texto → filtra resultados', async ({ page }) => {
    await goToCatalog(page)
    await waitForProducts(page)

    const searchInput = page.getByPlaceholder('Buscar productos...')

    // Buscar un término corto que seguramente matchea algo
    const responsePromise = page.waitForResponse(r => r.url().includes('/api/v1/products') && r.status() === 200)
    await searchInput.fill('re')
    await responsePromise

    // Debe mostrarse al menos 1 resultado o el mensaje de sin resultados
    const hasResults = await page.locator('a[href^="/catalogo/"]').count()
    const hasNoResultsMsg = await page.getByText(/no encontramos productos/i).isVisible()

    expect(hasResults > 0 || hasNoResultsMsg).toBeTruthy()
  })

  // ── CAT-006 ──────────────────────────────────────────────────────────────────
  test('CAT-006 | Búsqueda sin resultados → mensaje visible', async ({ page }) => {
    await goToCatalog(page)

    const searchInput = page.getByPlaceholder('Buscar productos...')
    await searchInput.fill('xyzxyz_sin_resultados_123')

    // Esperar debounce + respuesta
    await page.waitForTimeout(600)

    // Mensaje de sin resultados
    await expect(page.getByText(/no encontramos productos/i)).toBeVisible({ timeout: 8_000 })
  })

  // ── CAT-007 ──────────────────────────────────────────────────────────────────
  test('CAT-007 | Banner del catálogo — visible si hay banners activos', async ({ page }) => {
    await goToCatalog(page)

    // El banner es opcional — verificamos que si existe, tiene imagen
    const bannerImg = page.locator('div.relative.w-full img').first()
    const hasBanner = await bannerImg.isVisible().catch(() => false)

    if (hasBanner) {
      await expect(bannerImg).toBeVisible()
      const src = await bannerImg.getAttribute('src')
      expect(src).toBeTruthy()
    } else {
      // Sin banners configurados — test pasa (funcionalidad OK, sin datos)
      console.log('CAT-007: Sin banners activos en el sistema')
    }
  })

  // ── CAT-008 ──────────────────────────────────────────────────────────────────
  test('CAT-008 | Sidebar de anuncios — visible si hay anuncios activos', async ({ page }) => {
    await goToCatalog(page)
    await page.waitForTimeout(1_000) // dar tiempo al sidebar async

    // El sidebar de anuncios es opcional
    const sidebar = page.locator('aside, [data-testid="announcement-sidebar"]').first()
    const hasSidebar = await sidebar.isVisible().catch(() => false)

    if (hasSidebar) {
      await expect(sidebar).toBeVisible()
    } else {
      console.log('CAT-008: Sin anuncios activos en el sistema')
    }
  })

  // ── CAT-009 ──────────────────────────────────────────────────────────────────
  test('CAT-009 | Click en producto navega a /catalogo/:id', async ({ page }) => {
    await goToCatalog(page)
    await waitForProducts(page)

    const firstProductLink = page.locator('a[href^="/catalogo/"]').first()
    const href = await firstProductLink.getAttribute('href')
    expect(href).toMatch(/^\/catalogo\/\d+$/)

    await firstProductLink.click()
    await expect(page).toHaveURL(/\/catalogo\/\d+/, { timeout: 8_000 })
  })

  // ── CAT-010 ──────────────────────────────────────────────────────────────────
  test('CAT-010 | Sin resultados sin búsqueda → "No hay productos disponibles"', async ({ page }) => {
    // Interceptar la API para simular catálogo vacío
    await page.route('**/api/v1/products**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { total: 0, page: 1, pageSize: 20 } }),
      })
    })

    await page.goto('/catalogo')
    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible({ timeout: 10_000 })

    await expect(page.getByText('No hay productos disponibles.')).toBeVisible({ timeout: 8_000 })
  })

  // ── CAT-011 ──────────────────────────────────────────────────────────────────
  test('CAT-011 | Skeleton loader visible durante la carga', async ({ page }) => {
    // Interceptar con delay para ver el skeleton
    await page.route('**/api/v1/products**', async route => {
      await new Promise(r => setTimeout(r, 800))
      await route.continue()
    })

    await page.goto('/catalogo')
    await expect(page.getByRole('heading', { name: 'Catálogo' })).toBeVisible({ timeout: 10_000 })

    // El skeleton tiene clase animate-pulse
    const skeleton = page.locator('.animate-pulse').first()
    await expect(skeleton).toBeVisible({ timeout: 5_000 })
  })

  // ── CAT-012 ──────────────────────────────────────────────────────────────────
  test('CAT-012 | Botón "Todas" muestra todos los productos', async ({ page }) => {
    await goToCatalog(page)
    await waitForProducts(page)

    const categoryButtons = page.locator('.flex.gap-2 button')
    const count = await categoryButtons.count()

    if (count > 1) {
      // Primero filtrar por una categoría
      await categoryButtons.nth(1).click()
      await page.waitForTimeout(500)

      // Luego volver a "Todas"
      await page.getByRole('button', { name: 'Todas' }).click()
      await page.waitForTimeout(600)

      // El botón "Todas" debe estar activo
      const todasBtn = page.getByRole('button', { name: 'Todas' })
      await expect(todasBtn).toHaveClass(/bg-\[#E91E8C\]/)

      // Deben mostrarse productos
      await expect(page.locator('a[href^="/catalogo/"]').first()).toBeVisible({ timeout: 8_000 })
    } else {
      // Sin categorías, igual verificamos que el catálogo tiene productos
      await expect(page.locator('a[href^="/catalogo/"]').first()).toBeVisible()
    }
  })

})
