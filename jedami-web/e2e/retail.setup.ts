import { test as setup, expect } from '@playwright/test'

export const RETAIL_AUTH_FILE = 'playwright/.auth/retail.json'

const RETAIL = {
  email:    'e2e-retail@jedami.com',
  password: 'Test1234!',
}

const BFF = process.env.E2E_BFF_URL ?? 'http://localhost:3000/api/v1'

setup('autenticar usuario retail', async ({ page }) => {
  // Registrar si no existe (ignora error si ya existe)
  await fetch(`${BFF}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: RETAIL.email, password: RETAIL.password, customerType: 'retail' }),
  })

  await page.goto('/login')
  await page.getByPlaceholder('tu@email.com').fill(RETAIL.email)
  await page.getByPlaceholder('••••••••').fill(RETAIL.password)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL('/catalogo', { timeout: 10_000 })
  await page.context().storageState({ path: RETAIL_AUTH_FILE })
})
