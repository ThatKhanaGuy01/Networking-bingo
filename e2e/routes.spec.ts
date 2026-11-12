import { expect, test } from '@playwright/test'

for (const [path, heading] of [
  ['/admin', 'Admin'],
  ['/random', 'Random card'],
  ['/create', 'Build your own'],
  ['/play', 'No card saved'],
  ['/c/demo-card', 'Shared card unavailable'],
]) {
  test(`${path} loads directly`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  })
}

test('health and unknown API routes are handled by the Worker', async ({ request }) => {
  const health = await request.get('/health')
  expect(health.ok()).toBeTruthy()
  expect(await health.json()).toEqual({ status: 'ok' })

  const missing = await request.get('/api/missing')
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type']).toContain('application/json')
})

test('7 by 7 card fits a narrow phone and full prompts remain readable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 })
  await page.goto('/random')
  await page.getByLabel('Board size').selectOption('7')
  await page.getByLabel(/Seed/).fill('mobile-layout')
  await page.getByRole('button', { name: 'Create random card' }).click()

  const grid = page.getByRole('group', { name: '7 by 7 bingo card' })
  await expect(grid.locator('.bingo-tile')).toHaveCount(49)
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    board: document.querySelector('.bingo-grid')?.getBoundingClientRect().width ?? 0,
  }))
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport)
  expect(dimensions.board).toBeLessThanOrEqual(dimensions.viewport)
  await page.screenshot({ path: '/tmp/networking-bingo-mobile.png', fullPage: true })

  const details = page.getByRole('button', { name: /Read full task/ }).first()
  const fullPrompt = (await details.getAttribute('aria-label'))!.replace('Read full task: ', '')
  await details.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText(fullPrompt)
})
