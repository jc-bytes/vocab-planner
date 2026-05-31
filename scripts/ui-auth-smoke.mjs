import { spawn } from 'node:child_process';
import http from 'node:http';
import process from 'node:process';
import { chromium } from 'playwright';

import {
    AUDIT_ASSIGNMENT_IDS,
    AUDIT_PASSWORD,
    AUDIT_STUDENT_EMAIL,
    AUDIT_TEACHER_EMAIL,
    seedLocalAuditData
} from './lib/local-supabase-audit.mjs';

const host = process.env.UI_AUTH_SMOKE_HOST || '127.0.0.1';
const port = Number(process.env.UI_AUTH_SMOKE_PORT || 8000);
const baseUrl = (process.env.UI_AUTH_SMOKE_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');

function requestOk(url) {
    return new Promise((resolve) => {
        const request = http.get(url, (response) => {
            response.resume();
            resolve(response.statusCode >= 200 && response.statusCode < 500);
        });
        request.on('error', () => resolve(false));
        request.setTimeout(1000, () => {
            request.destroy();
            resolve(false);
        });
    });
}

async function waitForServer(url, timeoutMs = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await requestOk(url)) return true;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
}

async function resolveServer() {
    if (process.env.UI_AUTH_SMOKE_BASE_URL) {
        if (!(await waitForServer(`${baseUrl}/teacher.html`, 3000))) {
            throw new Error(`UI_AUTH_SMOKE_BASE_URL is not reachable: ${baseUrl}`);
        }
        return null;
    }

    if (await requestOk(`${baseUrl}/teacher.html`)) return null;

    const server = spawn('npx', ['vite', '--host', host, '--port', String(port), '--strictPort'], {
        cwd: process.cwd(),
        stdio: 'ignore'
    });

    if (!(await waitForServer(`${baseUrl}/teacher.html`))) {
        server.kill();
        throw new Error(`Could not start local server at ${baseUrl}`);
    }

    return server;
}

async function addLocalSupabaseOverride(context, browserConfig) {
    await context.addInitScript(config => {
        window.SUPABASE_CONFIG = {
            url: config.url,
            publishableKey: config.publishableKey
        };
    }, browserConfig);
}

function trackPageProblems(page, label, problems) {
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        problems.push(`[${label}] console.error: ${message.text()}`);
    });
    page.on('pageerror', (error) => {
        problems.push(`[${label}] pageerror: ${error.message}`);
    });
}

async function waitForApp(page) {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(350);
}

async function loginTeacher(page) {
    await page.goto(`${baseUrl}/teacher.html`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    if (await page.locator('#teacher-login-form').isVisible().catch(() => false)) {
        await page.fill('#teacher-email', AUDIT_TEACHER_EMAIL);
        await page.fill('#teacher-password', AUDIT_PASSWORD);
        await page.locator('#teacher-login-form button[type="submit"]').click();
    }
    await page.waitForFunction(() => (
        document.querySelector('#teacher-tab-shell:not(.hidden)')
        || document.querySelector('#teacher-login-error')?.textContent.trim()
    ), { timeout: 30000 });

    const errorText = await page.locator('#teacher-login-error').textContent().catch(() => '');
    if (errorText?.trim()) throw new Error(`Teacher login failed: ${errorText.trim()}`);
}

async function loginStudent(page) {
    await page.goto(`${baseUrl}/student.html`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    if (await page.locator('#student-login-form').isVisible().catch(() => false)) {
        await page.fill('#login-email', AUDIT_STUDENT_EMAIL);
        await page.fill('#login-password', AUDIT_PASSWORD);
        await page.locator('#student-login-form button[type="submit"]').click();
    }
    await page.waitForFunction(() => (
        document.querySelector('#student-tab-shell:not(.hidden)')
        || document.querySelector('#login-error')?.textContent.trim()
        || document.querySelector('#force-password-modal:not(.hidden)')
    ), { timeout: 30000 });

    if (await page.locator('#force-password-modal:not(.hidden)').count()) {
        throw new Error('Audit student account unexpectedly requires a password change.');
    }
    const errorText = await page.locator('#login-error').textContent().catch(() => '');
    if (errorText?.trim()) throw new Error(`Student login failed: ${errorText.trim()}`);
}

async function openStudentAssignment(page, assignmentId, titlePattern, readyPattern) {
    await page.goto(`${baseUrl}/student.html#/classroom-activities/${encodeURIComponent(assignmentId)}`, {
        waitUntil: 'domcontentloaded'
    });
    await waitForApp(page);
    await page.locator('#student-classroom-activity-view:not(.hidden)').waitFor({ timeout: 15000 });
    await page.locator('#student-classroom-activity-title').filter({ hasText: titlePattern }).waitFor({ timeout: 15000 });
    await page.waitForFunction(pattern => {
        const text = document.querySelector('#student-classroom-activity-save-status')?.textContent || '';
        return new RegExp(pattern).test(text);
    }, readyPattern.source, { timeout: 30000 });
}

async function submitOpenAssignment(page, label) {
    await page.locator('#student-submit-classroom-activity-btn').click();
    await page.waitForFunction(() => {
        const status = document.querySelector('#student-classroom-activity-save-status')?.textContent || '';
        const submit = document.querySelector('#student-submit-classroom-activity-btn')?.textContent || '';
        return /Submission saved|Activity submitted|Submitted/i.test(status)
            || /Resubmit/i.test(submit)
            || /Complete:|failed|unavailable|locally/i.test(status);
    }, null, { timeout: 30000 });

    const statusText = await page.locator('#student-classroom-activity-save-status').textContent().catch(() => '');
    if (/complete|required|failed|unavailable|locally/i.test(statusText || '')) {
        throw new Error(`${label} did not submit cleanly: ${statusText}`);
    }
}

async function submitCardSort(page) {
    await openStudentAssignment(page, 'audit-card-sort', /Audit Card Sort/, /Card sort ready/i);
    await page.locator('[data-card-sort-target-select="keyboard"]').selectOption('hardware');
    await page.locator('[data-card-sort-target-select="browser"]').selectOption('software');
    await submitOpenAssignment(page, 'Card sort');
}

async function submitSpreadsheet(page) {
    await openStudentAssignment(page, 'audit-spreadsheet-table', /Audit Spreadsheet Table/, /Spreadsheet ready/i);
    await page.locator('[data-spreadsheet-cell][data-spreadsheet-row="1"][data-spreadsheet-column="0"]').fill('Audit row');
    await page.locator('[data-spreadsheet-cell][data-spreadsheet-row="1"][data-spreadsheet-column="1"]').fill('7');
    await page.locator('[data-spreadsheet-reflection-id="pattern"]').fill('The local audit row saved correctly.');
    await page.locator('[data-spreadsheet-generate-chart]').click();
    await page.waitForTimeout(500);
    await submitOpenAssignment(page, 'Spreadsheet');
}

async function submitImageHotspot(page) {
    await openStudentAssignment(page, 'audit-image-hotspot', /Audit Image Hotspot/, /Image activity ready/i);
    const image = page.locator('[data-image-hotspot-stage] img');
    await image.waitFor({ state: 'visible', timeout: 15000 });
    const box = await image.boundingBox();
    if (!box) throw new Error('Image hotspot image is not clickable.');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.locator('[data-image-hotspot-pin-id]').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-image-hotspot-reflection="evidence"]').fill('The audit marker was placed.');
    await submitOpenAssignment(page, 'Image hotspot');
}

async function waitForSubmitted(admin, assignmentId) {
    const started = Date.now();
    while (Date.now() - started < 15000) {
        const { data, error } = await admin
            .from('classroom_activity_submissions')
            .select('id,status')
            .eq('assignment_id', assignmentId)
            .eq('status', 'submitted');
        if (error) throw error;
        if ((data || []).length > 0) return;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`No submitted audit response found for ${assignmentId}.`);
}

async function verifyTeacherReview(page, assignmentId, titlePattern) {
    await page.goto(`${baseUrl}/teacher.html#/teacher/activities/assignment/${encodeURIComponent(assignmentId)}`, {
        waitUntil: 'domcontentloaded'
    });
    await waitForApp(page);
    await page.locator('#teacher-activity-assignment-view:not(.hidden)').waitFor({ timeout: 15000 });
    await page.locator('#activity-assignment-title').filter({ hasText: titlePattern }).waitFor({ timeout: 15000 });
    await page.waitForFunction(() => {
        const summary = document.querySelector('#activity-submission-summary')?.textContent || '';
        return /1 submitted/i.test(summary);
    }, null, { timeout: 30000 });
    await page.locator('.activity-submission-row.status-submitted').filter({ hasText: /Audit Student/ }).first().waitFor({ timeout: 15000 });
}

async function verifyTeacherEditor(page) {
    await page.goto(`${baseUrl}/teacher.html#/teacher/activities/editor`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await page.locator('#activity-type').waitFor({ state: 'visible', timeout: 15000 });
    const values = await page.locator('#activity-type option').evaluateAll(options => options.map(option => option.value));
    for (const value of ['card-sort', 'spreadsheet-table', 'image-hotspot']) {
        if (!values.includes(value)) throw new Error(`Teacher editor missing activity type option: ${value}`);
    }
}

let server = null;
let browser = null;
const problems = [];

try {
    const seeded = await seedLocalAuditData({ resetSubmissions: true });
    server = await resolveServer();
    browser = await chromium.launch();

    const teacherContext = await browser.newContext();
    const studentContext = await browser.newContext();
    await addLocalSupabaseOverride(teacherContext, seeded.browserConfig);
    await addLocalSupabaseOverride(studentContext, seeded.browserConfig);

    const teacherPage = await teacherContext.newPage();
    const studentPage = await studentContext.newPage();
    trackPageProblems(teacherPage, 'teacher', problems);
    trackPageProblems(studentPage, 'student', problems);

    await loginTeacher(teacherPage);
    await loginStudent(studentPage);
    await verifyTeacherEditor(teacherPage);

    await submitCardSort(studentPage);
    await waitForSubmitted(seeded.admin, 'audit-card-sort');
    await submitSpreadsheet(studentPage);
    await waitForSubmitted(seeded.admin, 'audit-spreadsheet-table');
    await submitImageHotspot(studentPage);
    await waitForSubmitted(seeded.admin, 'audit-image-hotspot');

    await verifyTeacherReview(teacherPage, 'audit-card-sort', /Audit Card Sort/);
    await verifyTeacherReview(teacherPage, 'audit-spreadsheet-table', /Audit Spreadsheet Table/);
    await verifyTeacherReview(teacherPage, 'audit-image-hotspot', /Audit Image Hotspot/);

    if (problems.length > 0) {
        throw new Error(`Authenticated UI smoke emitted browser problems:\n${problems.join('\n')}`);
    }

    console.log(`Authenticated UI smoke passed for ${AUDIT_ASSIGNMENT_IDS.join(', ')} at ${baseUrl}`);
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
