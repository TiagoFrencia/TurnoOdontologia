// @ts-check
const { test, expect } = require('@playwright/test');

const BASE  = 'https://frontend-xi-one-53.vercel.app';
const EMAIL = 'ignacio@test.com';
const PASS  = 'ignacio123';

test('vercel — login carga nombre dinámico desde Railway', async ({ page }) => {
  await page.goto(`${BASE}/login.html?slug=rossetti`);
  await page.waitForSelector('#inp-email');
  await page.waitForFunction(() =>
    document.getElementById('brand-heading')?.textContent?.includes('Ignacio')
  , { timeout: 10000 });
  const h = await page.locator('#brand-heading').textContent();
  console.log(`✓ Vercel heading: "${h}"`);
  expect(h).toContain('Ignacio');
});

test('vercel — login + dashboard dinámico', async ({ page }) => {
  await page.goto(`${BASE}/login.html?slug=rossetti`);
  await page.waitForSelector('#inp-email');
  await page.fill('#inp-email', EMAIL);
  await page.fill('#inp-password', PASS);
  await page.click('#btn-submit');
  await page.waitForURL(`${BASE}/dashboard.html`, { timeout: 15000 });

  await page.waitForFunction(() =>
    !document.getElementById('sidebar-name')?.textContent?.includes('Cargando')
  , { timeout: 10000 });

  const name = await page.locator('#sidebar-name').textContent();
  const greeting = await page.locator('#greeting').textContent();
  console.log(`✓ Sidebar: "${name}"`);
  console.log(`✓ Saludo: "${greeting}"`);

  expect(name).toContain('Rossetti');
  expect(greeting).toMatch(/Buenos|Buenas/);
});
