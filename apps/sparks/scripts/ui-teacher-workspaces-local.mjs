import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { assertNoAccessibilityViolations } from './lib/accessibility-audit.mjs';
import { AUDIT_PASSWORD, AUDIT_TEACHER_EMAIL, AUDIT_STUDENT_EMAIL, readLocalSupabaseStatus, getBrowserSupabaseConfig } from './lib/local-supabase-audit.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';

// Uses existing local fixtures only. Never seed/reset accounts or publish/save data.
const port = Number(process.env.UI_TEACHER_WORKSPACES_LOCAL_PORT || 8043);
const baseUrl = `http://127.0.0.1:${port}`;
const output = '/tmp/sparks-teacher-workspaces-local';
let server, browser, lastPage;
const problems = [], checkpoints = [];
try {
    const config = getBrowserSupabaseConfig(await readLocalSupabaseStatus({ startIfStopped: false }));
    await mkdir(output, { recursive: true });
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port });
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(value => { window.SUPABASE_CONFIG = value; }, config);
    await context.routeWebSocket(url => url.host === `127.0.0.1:${port}`, socket => socket.close());
    const page = await context.newPage(); lastPage = page;
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => problems.push(error.message));
    page.on('request', request => {
        if (/\/rest\/v1\//.test(request.url()) && !['GET', 'HEAD'].includes(request.method()) && !/\/rpc\//.test(request.url())) problems.push(`Unexpected data write: ${request.method()} ${new URL(request.url()).pathname}`);
        if (/\/rpc\/(publish_|invite_|remove_|withdraw_|save_|check_class_|create_)/.test(request.url())) problems.push(`Unexpected mutation RPC: ${new URL(request.url()).pathname}`);
    });
    async function checkpoint(name, include) {
        if (!include.includes('dialog')) await page.waitForFunction(() => {
            const main = document.querySelector('main.teacher-main')?.getBoundingClientRect();
            const sidebar = document.querySelector('#teacher-tab-shell')?.getBoundingClientRect();
            return main && sidebar && main.left >= sidebar.right - 1;
        });
        await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, animations: 'disabled' });
        await assertNoAccessibilityViolations(page, name, { include });
        checkpoints.push(name);
    }
    await page.goto(`${baseUrl}/teacher.html`, { waitUntil: 'domcontentloaded' });
    await page.locator('#teacher-email').fill(AUDIT_TEACHER_EMAIL);
    await page.locator('#teacher-password').fill(AUDIT_PASSWORD);
    await page.locator('#teacher-login-form button[type="submit"]').click();
    await page.locator('#teacher-tab-shell:not(.hidden)').waitFor({ timeout: 30000 });
    await page.locator('#tab-classes').click();
    const classes = page.locator('#teacher-classes-view');
    const auditClass = classes.locator('article').filter({ has: page.getByRole('heading', { name: 'Audit 6A', exact: true }) });
    await auditClass.getByRole('button', { name: 'Open class' }).waitFor();
    await checkpoint('classes-directory', ['#teacher-tab-shell', '#teacher-classes-view']);
    await auditClass.getByRole('button', { name: 'Open class' }).click();
    await classes.getByRole('button', { name: 'Invite students' }).waitFor();
    await classes.getByText(/audit.student@aid.edu.pa/).waitFor();
    const classId = await page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('class'));
    assert.ok(classId, 'Private class ID persisted in route');
    await checkpoint('class-students', ['#teacher-classes-view']);
    await classes.getByRole('button', { name: 'Invite students' }).click();
    await checkpoint('invite-dialog', ['dialog']);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await classes.getByRole('button', { name: 'Work', exact: true }).click();
    await classes.getByRole('button', { name: 'Review work' }).first().waitFor();
    await checkpoint('class-work', ['#teacher-classes-view']);
    await classes.getByRole('button', { name: 'Assign material' }).click();
    await page.getByRole('dialog').locator('input[type="checkbox"]:checked').first().waitFor();
    const selected = await page.getByRole('dialog').locator('input[name="classIds"]:checked').evaluateAll(nodes => nodes.map(node => node.value));
    assert.deepEqual(selected, [classId], 'Publisher preselects the current private class');
    await checkpoint('publisher-dialog', ['dialog']);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.locator('#tab-assignments').click();
    const assignments = page.locator('#teacher-assignments-view');
    await assignments.locator('select[name=class]').selectOption(classId);
    await assignments.getByRole('button', { name: 'Review work' }).first().waitFor();
    await checkpoint('assignments', ['#teacher-assignments-view']);
    await assignments.getByRole('button', { name: 'Review work' }).first().click();
    const review = page.locator('#teacher-review-view');
    await review.getByRole('button', { name: 'Export results' }).waitFor();
    await checkpoint('review', ['#teacher-review-view']);
    await review.getByRole('button', { name: 'Export results' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Download CSV' }).waitFor();
    await checkpoint('export-dialog', ['dialog']);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await page.goto(`${baseUrl}/teacher.html#/teacher/classes?class=${encodeURIComponent(classId)}&tab=students`);
    await classes.getByRole('button', { name: 'Make groups' }).waitFor();
    await classes.getByRole('button', { name: 'Make groups' }).click();
    await page.locator('#teacher-groups-view:not(.hidden)').waitFor();
    await page.waitForFunction(id => document.querySelector('#group-class-select')?.value === id, classId);
    assert.equal(await page.locator('#group-class-select').inputValue(), classId);
    await checkpoint('class-groups', ['#teacher-groups-view']);
    const student = await context.newPage();
    await student.goto(`${baseUrl}/student.html`, { waitUntil: 'domcontentloaded' });
    await student.locator('#login-email').fill(AUDIT_STUDENT_EMAIL);
    await student.locator('#login-password').fill(AUDIT_PASSWORD);
    await student.locator('#student-login-form button[type="submit"]').click();
    await student.locator('#student-tab-shell:not(.hidden)').waitFor({ timeout: 30000 });
    await student.goto(`${baseUrl}/student.html#/classes`);
    await student.locator('#student-classes-view').getByRole('heading', { name: /Audit 6A/ }).waitFor();
    assert.ok(await student.locator('#student-classes-view article button').count(), 'Enrolled student can see existing assignment buttons');
    await student.screenshot({ path: `${output}/student-classes.png`, fullPage: true, animations: 'disabled' });
    await assertNoAccessibilityViolations(student, 'Student classes', { include: ['#student-classes-view'] });
    checkpoints.push('student-classes');
    assert.deepEqual(problems, []);
    console.log(JSON.stringify({ passed: checkpoints, screenshots: output, dataMutations: 0 }, null, 2));
} catch (error) {
    if (lastPage) { await lastPage.screenshot({ path: `${output}/failure.png`, fullPage: true, animations: 'disabled' }); console.error(await lastPage.locator('#teacher-classes-view, #teacher-assignments-view').allTextContents()); console.error(problems); }
    console.error(`Completed checkpoints: ${checkpoints.join(', ')}`);
    throw error;
} finally { await browser?.close(); server?.kill(); }
