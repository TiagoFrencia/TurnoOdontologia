// @ts-check
const { test, expect } = require('@playwright/test');

const BASE  = 'https://worthy-tenderness-production-2989.up.railway.app';
const EMAIL = 'ignacio@test.com';
const PASS  = 'ignacio123';

test('producción — login, dashboard dinámico y cerrar sesión', async ({ page }) => {

  // ── 1. Login carga con nombre del consultorio ────────────────
  await page.goto(`${BASE}/login.html?slug=rossetti`);
  await page.waitForSelector('#inp-email');
  await page.waitForFunction(() =>
    document.getElementById('brand-heading')?.textContent?.includes('Ignacio')
  , { timeout: 8000 });
  await page.screenshot({ path: 'tests/screenshots/prod-01-login.png' });
  console.log('✓ Login con nombre dinámico: "Bienvenido, Ignacio"');

  // ── 2. Login exitoso ─────────────────────────────────────────
  await page.fill('#inp-email', EMAIL);
  await page.fill('#inp-password', PASS);
  await page.click('#btn-submit');
  await page.waitForURL(`${BASE}/dashboard.html`, { timeout: 12000 });
  await page.screenshot({ path: 'tests/screenshots/prod-02-dashboard-loading.png' });

  // ── 3. Nombre dinámico cargó desde /api/me ───────────────────
  await page.waitForFunction(() =>
    !document.getElementById('sidebar-name')?.textContent?.includes('Cargando')
  , { timeout: 8000 });
  await page.waitForFunction(() =>
    document.getElementById('greeting')?.textContent?.match(/Buenos|Buenas/)
  , { timeout: 5000 });
  await page.waitForSelector('#stat-today');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/screenshots/prod-03-dashboard-cargado.png' });

  const sidebarName = await page.locator('#sidebar-name').textContent();
  const greeting    = await page.locator('#greeting').textContent();
  const footerMp    = await page.locator('#footer-mp').textContent();
  console.log(`✓ Sidebar: "${sidebarName}"`);
  console.log(`✓ Saludo: "${greeting}"`);
  console.log(`✓ Footer: "${footerMp}"`);

  expect(sidebarName).toContain('Rossetti');
  expect(greeting).toMatch(/Buenos|Buenas/);
  expect(footerMp).toContain('M.P.');

  // ── 4. Buscador en producción ────────────────────────────────
  await page.click('#nav-buscar');
  await page.waitForSelector('#search-input');
  await page.fill('#search-input', 'lean');
  await page.waitForSelector('#search-results .appt-card', { timeout: 8000 });
  await page.screenshot({ path: 'tests/screenshots/prod-04-buscador.png' });
  const result = await page.locator('#search-results .appt-name').first().textContent();
  console.log(`✓ Buscador: encontró "${result}"`);

  // ── 5. Configuración cargó datos reales ─────────────────────
  await page.click('#nav-config');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/screenshots/prod-05-config.png' });
  const nombre = await page.locator('#cfg-nombre').inputValue();
  console.log(`✓ Config: nombre del profesional = "${nombre}"`);
  expect(nombre.length).toBeGreaterThan(0);

  // ── 6. Cerrar sesión ─────────────────────────────────────────
  await page.click('#btn-logout');
  await page.waitForURL(`${BASE}/login.html*`, { timeout: 8000 });
  await page.screenshot({ path: 'tests/screenshots/prod-06-logout.png' });
  console.log('✓ Logout redirige al login');

  // ── 7. Auth guard en producción ──────────────────────────────
  await page.goto(`${BASE}/dashboard.html`);
  await page.waitForURL(`${BASE}/login.html*`, { timeout: 8000 });
  console.log('✓ Auth guard funciona en producción');
});
