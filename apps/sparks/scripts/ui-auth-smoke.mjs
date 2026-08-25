import process from 'node:process';
import { chromium } from 'playwright';

import {
    AUDIT_PASSWORD,
    AUDIT_STUDENT_EMAIL,
    AUDIT_TEACHER_EMAIL,
    seedLocalAuditData
} from './lib/local-supabase-audit.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_AUTH_SMOKE_HOST || '127.0.0.1';
const port = Number(process.env.UI_AUTH_SMOKE_PORT || 8000);
const baseUrl = (process.env.UI_AUTH_SMOKE_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');

async function resolveServer() {
    return ensureViteServer({
        baseUrl,
        probePath: '/teacher.html',
        host,
        port,
        external: Boolean(process.env.UI_AUTH_SMOKE_BASE_URL)
    });
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

const problems = [];
let server = null;
let browser = null;

try {
    const seeded = await seedLocalAuditData();
    server = await resolveServer();
    browser = await chromium.launch();

    const sharedContext = await browser.newContext();
    await addLocalSupabaseOverride(sharedContext, seeded.browserConfig);

    // Keep both roles in one browser profile. Their persisted Supabase sessions
    // must remain independent when a teacher and student page are open together.
    const teacherPage = await sharedContext.newPage();
    const studentPage = await sharedContext.newPage();
    trackPageProblems(teacherPage, 'teacher', problems);
    trackPageProblems(studentPage, 'student', problems);

    await loginTeacher(teacherPage);
    await teacherPage.locator('#tab-vocabulary').click();
    await teacherPage.locator('#teacher-dashboard-view:not(.hidden)').waitFor({ timeout: 15000 });
    await teacherPage.locator('#tab-sparks').click();
    await teacherPage.locator('#teacher-sparks-view:not(.hidden)').waitFor({ timeout: 15000 });

    await loginStudent(studentPage);
    await studentPage.locator('#main-menu-view:not(.hidden), #vocab-selection-view:not(.hidden)').first().waitFor({ timeout: 15000 });
    await studentPage.goto(`${baseUrl}/student.html#/units?all=1`, { waitUntil: 'domcontentloaded' });
    await studentPage.locator('#vocab-selection-view:not(.hidden)').waitFor({ timeout: 15000 });

    if (problems.length) {
        throw new Error(`Browser errors during auth smoke:\n${problems.join('\n')}`);
    }

    console.log('Authenticated UI smoke passed.');
} finally {
    await browser?.close().catch(() => {});
    if (server) server.kill();
}
