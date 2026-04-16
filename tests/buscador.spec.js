// @ts-check
const { test, expect } = require('@playwright/test');

const BASE  = 'http://localhost:3001';
const EMAIL = 'ignacio@test.com';
const PASS  = 'ignacio123';

test.beforeEach(async ({ page }) => {
  await page.goto(`${BASE}/login.html?slug=rossetti`);
  await page.waitForSelector('#inp-email');
  await page.fill('#inp-email', EMAIL);
  await page.fill('#inp-password', PASS);
  await page.click('#btn-submit');
  await page.waitForURL(`${BASE}/dashboard.html`);
  await page.waitForSelector('#stat-today');
});

test('buscador — encuentra turno existente', async ({ page }) => {
  // Navegar a Buscar paciente
  await page.click('#nav-buscar');
  await page.waitForSelector('#search-input');
  await page.screenshot({ path: 'tests/screenshots/buscar-01-vacio.png' });

  // Escribir búsqueda parcial
  await page.fill('#search-input', 'lean');
  // Esperar debounce (320ms) + fetch
  await page.waitForSelector('#search-results .appt-card', { timeout: 5000 });
  await page.screenshot({ path: 'tests/screenshots/buscar-02-resultado.png' });

  // Verificar que aparece el turno
  const card = page.locator('#search-results .appt-card').first();
  await expect(card).toBeVisible();
  const name = await card.locator('.appt-name').textContent();
  expect(name?.toLowerCase()).toContain('leandro');
  console.log(`✓ Turno encontrado: "${name}"`);
});

test('buscador — sin resultados muestra empty state', async ({ page }) => {
  await page.click('#nav-buscar');
  await page.waitForSelector('#search-input');

  await page.fill('#search-input', 'xyznoexiste');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/screenshots/buscar-03-vacio.png' });

  const empty = page.locator('#search-results .empty');
  await expect(empty).toBeVisible();
  console.log('✓ Empty state visible cuando no hay resultados');
});

test('buscador — campo vacío limpia resultados', async ({ page }) => {
  await page.click('#nav-buscar');
  await page.waitForSelector('#search-input');

  await page.fill('#search-input', 'lean');
  await page.waitForSelector('#search-results .appt-card', { timeout: 5000 });

  await page.fill('#search-input', '');
  await page.waitForTimeout(400);
  const results = page.locator('#search-results');
  const html = await results.innerHTML();
  expect(html.trim()).toBe('');
  console.log('✓ Limpiar campo vacía los resultados');
});
