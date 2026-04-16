// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3001';
const EMAIL = 'ignacio@test.com';
const PASS  = 'ignacio123';

test('flujo completo: login → dashboard → cerrar sesión', async ({ page }) => {

  // ── 1. Login page carga con nombre del consultorio ──────────
  await page.goto(`${BASE}/login.html?slug=rossetti`);
  await page.waitForSelector('#inp-email');
  // Espera a que el fetch del clinic-public actualice el título
  await page.waitForFunction(() =>
    document.getElementById('brand-heading')?.textContent?.includes('Ignacio')
  , { timeout: 5000 });
  await page.screenshot({ path: 'tests/screenshots/01-login.png' });
  console.log('✓ Login page cargó con nombre del consultorio');

  // ── 2. Llenar credenciales y enviar ─────────────────────────
  await page.fill('#inp-email', EMAIL);
  await page.fill('#inp-password', PASS);
  await page.screenshot({ path: 'tests/screenshots/02-login-filled.png' });
  await page.click('#btn-submit');

  // ── 3. Dashboard carga ───────────────────────────────────────
  await page.waitForURL(`${BASE}/dashboard.html`, { timeout: 10000 });
  await page.waitForSelector('#stat-today', { timeout: 8000 });
  // Esperar a que los stats carguen (dejan de ser "—")
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tests/screenshots/03-dashboard-hoy.png' });
  console.log('✓ Dashboard cargó');

  // ── 4. Navegar a Próximos turnos ─────────────────────────────
  await page.click('#nav-proximos');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/screenshots/04-dashboard-proximos.png' });
  console.log('✓ Sección Próximos turnos');

  // ── 5. Navegar a Servicios ───────────────────────────────────
  await page.click('#nav-servicios');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/screenshots/05-dashboard-servicios.png' });
  console.log('✓ Sección Servicios');

  // ── 6. Navegar a Configuración ───────────────────────────────
  await page.click('#nav-config');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/screenshots/06-dashboard-config.png' });
  console.log('✓ Sección Configuración');

  // ── 7. Cerrar sesión ─────────────────────────────────────────
  await page.click('#btn-logout');
  await page.waitForURL(`${BASE}/login.html*`, { timeout: 8000 });
  await page.waitForSelector('#inp-email');
  await page.screenshot({ path: 'tests/screenshots/07-logout.png' });
  console.log('✓ Sesión cerrada, redirigido a login');

  // ── 8. Verificar que el dashboard requiere auth ───────────────
  await page.goto(`${BASE}/dashboard.html`);
  await page.waitForURL(`${BASE}/login.html*`, { timeout: 8000 });
  await page.screenshot({ path: 'tests/screenshots/08-auth-guard.png' });
  console.log('✓ Auth guard funciona — redirige a login sin sesión');
});
