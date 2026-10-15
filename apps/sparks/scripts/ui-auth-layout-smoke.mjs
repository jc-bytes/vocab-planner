import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const built = process.env.AUTH_LAYOUT_DIST === '1';
const port = built ? 8082 : 8081;
const baseUrl = process.env.AUTH_LAYOUT_BASE_URL || `http://127.0.0.1:${port}`;
const output = process.env.AUTH_LAYOUT_OUTPUT || '/tmp/sparks-auth-layout-smoke';
const server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
  external: Boolean(process.env.AUTH_LAYOUT_BASE_URL),
  ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  // Empty, isolated test sessions exercise the real startup and rendering path.
  // These fixture credentials cannot reach a real Auth project.
  if (!process.env.AUTH_LAYOUT_BASE_URL) {
    await page.addInitScript(() => { window.SUPABASE_CONFIG = { url: 'https://auth-layout-fixture.invalid', publishableKey: 'layout-test-public-key' }; });
    await page.route('https://auth-layout-fixture.invalid/**', route => route.abort());
  }
  await mkdir(output, { recursive: true });
  for (const [role, cardSelector, passwordId] of [
    ['student', '#login-view .login-container', 'login-password'],
    ['teacher', '#teacher-login-view .teacher-login-card', 'teacher-password']
  ]) {
    await page.goto(`${baseUrl}/${role}.html`);
    const card = page.locator(cardSelector);
    const recover = card.getByRole('button', { name: 'Forgot password?', exact: true });
    await recover.waitFor();
    assert.equal(await card.locator('.auth-password-label').getByRole('button', { name: 'Forgot password?', exact: true }).count(), 1);
    assert.equal(await card.getByRole('button', { name: 'Create invited account', exact: true }).count(), 1);
    assert.equal(await page.getByRole('heading', { name: 'New or returning account' }).count(), 0);
    assert.equal(await card.locator('.form-group').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${role} fits ${width}`);
      assert.ok(await card.evaluate(el => { const bounds = el.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }), `${role} card stays inside ${width}`);
      await page.screenshot({ path: `${output}/${role}-${width}.png`, fullPage: true });
    }
    await recover.click();
    await page.getByRole('heading', { name: 'Recover your account' }).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await card.getByRole('button', { name: 'Create invited account', exact: true }).click();
    await page.getByRole('heading', { name: 'Create your invited account' }).waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await card.getByRole('button', { name: 'Show password', exact: true }).click();
    assert.equal(await page.locator(`#${passwordId}`).getAttribute('type'), 'text');
  }
  console.log(JSON.stringify({ passed: true, built, roles: 2, widths: 4, accountLinks: true, passwordToggle: true, screenshots: output }));
} finally { await browser.close(); server?.kill(); }
