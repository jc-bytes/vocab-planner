import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { readLocalSupabaseStatus, createLocalAdminClient, getBrowserSupabaseConfig } from './lib/local-supabase-audit.mjs';

const built = process.env.UI_PASSWORD_ISOLATION_DIST === '1';
const port = Number(process.env.UI_PASSWORD_ISOLATION_PORT || 8699), baseUrl = `http://127.0.0.1:${port}`;
let browser, server, admin, lastPage, stage = 'setup';
const users = [], clients = [], pageErrors = [];
try {
    const status = await readLocalSupabaseStatus({ startIfStopped: false });
    const config = getBrowserSupabaseConfig(status);
    admin = createLocalAdminClient(status);
    async function actor(label) {
        const email = `password-${crypto.randomUUID()}-${label}@aid.edu.pa`, password = `Fixture-${crypto.randomUUID()}1!`;
        const provisioning = crypto.randomUUID();
        await admin.rpc('issue_auth_user_provisioning_ticket', { p_email: email, p_token: provisioning }).throwOnError();
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
            user_metadata: { provisioning_token: provisioning, first_name: 'Password', last_name: label } });
        assert.ifError(created.error); users.push(created.data.user.id);
        await admin.from('profiles').update({ role: 'student', first_name: 'Password', last_name: label, must_change_password: true })
            .eq('user_id', created.data.user.id).throwOnError();
        return { id: created.data.user.id, email, password };
    }
    const a = await actor('A'), b = await actor('B');
    async function verifyPassword(actor, password) {
        const client = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        clients.push(client);
        const result = await client.auth.signInWithPassword({ email: actor.email, password });
        assert.ifError(result.error); assert.equal(result.data.user.id, actor.id);
    }
    async function flag(actor) {
        return (await admin.from('profiles').select('must_change_password').eq('user_id', actor.id).single().throwOnError()).data.must_change_password;
    }
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    async function context() {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)));
        await context.grantPermissions(['local-network-access'], { origin: baseUrl });
        await context.addInitScript(value => { window.SUPABASE_CONFIG = value; }, config);
        await context.route(`${baseUrl}/*.html*`, async route => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()).replace("connect-src 'self'", `connect-src 'self' ${config.url} ${config.url.replace('http:', 'ws:')}`) });
        });
        return context;
    }
    async function login(page, actor) {
        await page.goto(`${baseUrl}/student.html`);
        await page.locator('#login-email').fill(actor.email);
        await page.locator('#login-password').fill(actor.password);
        await page.locator('#student-login-form button[type=submit]').click();
        await page.locator('#force-password-modal:not(.hidden)').waitFor();
    }
    async function fillForced(page, password) {
        await page.locator('#change-password-new').fill(password);
        await page.locator('#change-password-confirm').fill(password);
    }
    async function switchToB(page) {
        await page.evaluate(async ({ email, password }) => {
            document.getElementById('login-email').value = email;
            document.getElementById('login-password').value = password;
            await studentApp.auth.handleStudentLogin({ preventDefault() {} });
        }, b);
        await page.waitForFunction(id => window.studentApp?.currentUser?.uid === id, b.id);
    }
    async function recovery(page) {
        const generated = await admin.auth.admin.generateLink({ type: 'recovery', email: a.email });
        assert.ifError(generated.error);
        const verified = await fetch(generated.data.properties.action_link, { redirect: 'manual' });
        const location = new URL(verified.headers.get('location'));
        assert.ok(location.hash.includes('type=recovery'), 'Auth verification must produce a recovery session');
        await page.goto(`${baseUrl}/student.html${location.hash}`);
        await page.getByRole('heading', { name: 'Choose a new password' }).waitFor();
    }

    stage = 'normal forced password change';
    const normalContext = await context(), normal = await normalContext.newPage();
    lastPage = normal; let puts = 0;
    normal.on('request', request => { if (request.method() === 'PUT' && new URL(request.url()).pathname === '/auth/v1/user') puts++; });
    await login(normal, a);
    const first = `Changed-${crypto.randomUUID()}1!`;
    await fillForced(normal, first);
    await normal.evaluate(() => { document.getElementById('change-password-form').requestSubmit(); document.getElementById('change-password-form').requestSubmit(); });
    await normal.waitForFunction(() => window.studentApp?.authInitialized && !window.studentApp.mustChangePassword && document.getElementById('force-password-modal').classList.contains('hidden'));
    await normal.waitForFunction(() => document.getElementById('student-tab-shell')?.classList.contains('hidden') === false);
    assert.equal(puts, 1, 'Repeated submits must issue one password mutation');
    assert.equal(await flag(a), false); assert.equal(await flag(b), true);
    await verifyPassword(a, first); a.password = first;
    await verifyPassword(b, b.password);
    await normalContext.close();

    stage = 'real recovery success';
    const recoveryContext = await context(), recovered = await recoveryContext.newPage();
    lastPage = recovered; await recovery(recovered);
    const second = `Recovered-${crypto.randomUUID()}2!`;
    await recovered.getByLabel('Password, at least 10 characters').fill(second);
    await recovered.getByRole('button', { name: 'Save password', exact: true }).click();
    await recovered.getByText('Password saved.', { exact: true }).waitFor();
    assert.equal(await recovered.getByLabel('Password, at least 10 characters').inputValue(), '');
    await verifyPassword(a, second); a.password = second;
    await verifyPassword(b, b.password);
    await recoveryContext.close();

    stage = 'recovery intent is purged on account switch';
    const staleContext = await context(), stale = await staleContext.newPage();
    lastPage = stale; await recovery(stale);
    await stale.getByLabel('Password, at least 10 characters').fill('Old-account-draft-123');
    await stale.evaluate(() => { window.oldRecoveryField = document.querySelector('dialog input[type=password]'); });
    await switchToB(stale);
    assert.equal(await stale.getByRole('heading', { name: 'Choose a new password' }).count(), 0);
    assert.equal(await stale.evaluate(() => window.oldRecoveryField.value), '');
    assert.equal(await flag(b), true); await verifyPassword(b, b.password);
    await staleContext.close();

    stage = 'switch while Auth update is pending';
    await admin.from('profiles').update({ must_change_password: true }).eq('user_id', a.id).throwOnError();
    const raceContext = await context(), race = await raceContext.newPage();
    lastPage = race; await login(race, a);
    let reached; const entered = new Promise(resolve => { reached = resolve; });
    let resume; const release = new Promise(resolve => { resume = resolve; });
    let held = false;
    await race.route(`${config.url}/auth/v1/user`, async route => {
        if (route.request().method() !== 'PUT') return route.continue();
        held = true; reached(); await release;
        await route.abort().catch(() => {});
    });
    await fillForced(race, `Cancelled-${crypto.randomUUID()}3!`);
    await race.getByRole('button', { name: 'Update Password', exact: true }).click();
    await entered;
    await switchToB(race); resume();
    await race.waitForFunction(() => window.studentApp?.auth.ui.passwordChangePending === false);
    assert.equal(held, true);
    assert.equal(await race.locator('#change-password-new').inputValue(), '');
    assert.equal(await race.locator('#change-password-confirm').inputValue(), '');
    assert.equal(await flag(a), true); assert.equal(await flag(b), true);
    await verifyPassword(a, a.password); await verifyPassword(b, b.password);
    await raceContext.close();
    assert.deepEqual(pageErrors, [], 'Password flows must not leave unhandled browser errors');
    console.log(`Password isolation ${built ? 'built' : 'source'}: real Auth forced/recovery success, duplicate submit, stale recovery purge, account-switch abort, and unchanged B password/profile passed.`);
} catch (error) {
    if (lastPage && !lastPage.isClosed()) console.error('Safe UI state:', await lastPage.evaluate(() => ({ passwordStatus: document.getElementById('change-password-status')?.textContent, loginError: document.getElementById('login-error')?.textContent, mustChange: window.studentApp?.mustChangePassword, authReady: window.studentApp?.authInitialized })).catch(() => null));
    // Never print recovery URLs, bearer tokens, or credentials on failure.
    console.error(`Password isolation failed during ${stage}: ${String(error.message).replace(/https?:\/\/[^\s)]+/g, '[URL omitted]')}`);
    process.exitCode = 1;
} finally {
    await browser?.close(); server?.kill();
    for (const client of clients) await client.auth.dispose();
    for (const id of users.reverse()) {
        const result = await admin.auth.admin.deleteUser(id);
        if (result.error) { console.error('Disposable password fixture cleanup failed.'); process.exitCode = 1; }
    }
    await admin?.auth.dispose();
}
