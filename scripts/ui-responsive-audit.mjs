import { spawn } from 'node:child_process';
import http from 'node:http';
import process from 'node:process';
import { chromium } from 'playwright';

const widths = [320, 360, 390, 430, 768, 1024, 1280];
const viewportHeight = 900;
const requiredEnv = ['UI_AUDIT_TEACHER_EMAIL', 'UI_AUDIT_STUDENT_EMAIL', 'UI_AUDIT_PASSWORD'];
const allowedScrollableSelectors = [
    '.table-scroll-wrapper',
    '.student-progress-table-wrap',
    '.word-search-grid-container',
    '.cw-grid',
    '.modal-body',
    '.modal-content',
    '#activity-container'
];

for (const key of requiredEnv) {
    if (!process.env[key]) {
        console.error(`Missing ${key}. Set audit credentials with environment variables.`);
        process.exit(1);
    }
}

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

async function resolveBaseUrl() {
    if (process.env.UI_AUDIT_BASE_URL) {
        return { baseUrl: process.env.UI_AUDIT_BASE_URL.replace(/\/$/, ''), server: null };
    }

    const port = Number(process.env.UI_AUDIT_PORT || 8000);
    const baseUrl = `http://127.0.0.1:${port}`;
    if (await requestOk(`${baseUrl}/teacher.html`)) {
        return { baseUrl, server: null };
    }

    const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
        cwd: process.cwd(),
        stdio: 'ignore'
    });

    if (!(await waitForServer(`${baseUrl}/teacher.html`))) {
        server.kill();
        throw new Error(`Could not start local server at ${baseUrl}`);
    }

    return { baseUrl, server };
}

async function waitForApp(page) {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(350);
}

async function loginTeacher(page, baseUrl) {
    await page.goto(`${baseUrl}/teacher.html`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);

    if (await page.locator('#teacher-login-form').isVisible().catch(() => false)) {
        await page.fill('#teacher-email', process.env.UI_AUDIT_TEACHER_EMAIL);
        await page.fill('#teacher-password', process.env.UI_AUDIT_PASSWORD);
        await page.locator('#teacher-login-form button[type="submit"]').click();
    }

    await page.waitForFunction(() => {
        return document.querySelector('#teacher-tab-shell:not(.hidden)')
            || document.querySelector('#teacher-login-error')?.textContent.trim();
    }, { timeout: 30000 });

    const errorText = await page.locator('#teacher-login-error').textContent().catch(() => '');
    if (errorText?.trim()) {
        throw new Error(`Teacher login failed: ${errorText.trim()}`);
    }
}

async function loginStudent(page, baseUrl) {
    await page.goto(`${baseUrl}/student.html`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);

    if (await page.locator('#student-login-form').isVisible().catch(() => false)) {
        await page.fill('#login-email', process.env.UI_AUDIT_STUDENT_EMAIL);
        await page.fill('#login-password', process.env.UI_AUDIT_PASSWORD);
        await page.locator('#student-login-form button[type="submit"]').click();
    }

    await page.waitForFunction(() => {
        return document.querySelector('#student-tab-shell:not(.hidden)')
            || document.querySelector('#login-error')?.textContent.trim()
            || document.querySelector('#force-password-modal:not(.hidden)');
    }, { timeout: 30000 });

    if (await page.locator('#force-password-modal:not(.hidden)').count()) {
        throw new Error('Student account requires a password change; audit will not submit that form.');
    }

    const errorText = await page.locator('#login-error').textContent().catch(() => '');
    if (errorText?.trim()) {
        throw new Error(`Student login failed: ${errorText.trim()}`);
    }
}

async function auditRoute(page, url, label) {
    for (const width of widths) {
        await page.setViewportSize({ width, height: viewportHeight });
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await waitForApp(page);

        const result = await page.evaluate(({ allowedScrollableSelectors }) => {
            const isVisible = (element) => {
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && rect.width > 0
                    && rect.height > 0;
            };

            const rootOverflow = Math.ceil(
                Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
            );

            const overflowOffenders = Array.from(document.body.querySelectorAll('*'))
                .filter(isVisible)
                .filter(element => !allowedScrollableSelectors.some(selector => element.closest(selector)))
                .map(element => {
                    const rect = element.getBoundingClientRect();
                    return {
                        tag: element.tagName.toLowerCase(),
                        id: element.id,
                        className: String(element.className || ''),
                        left: Math.round(rect.left),
                        right: Math.round(rect.right)
                    };
                })
                .filter(item => item.right > window.innerWidth + 2 || item.left < -2)
                .slice(0, 6);

            const controls = Array.from(document.querySelectorAll([
                'a[href]',
                'button',
                'input:not([type="hidden"])',
                'select',
                'textarea',
                '[role="button"]',
                '[role="tab"]'
            ].join(','))).filter(isVisible);

            const smallControls = controls.map(element => {
                const rect = element.getBoundingClientRect();
                const type = element.getAttribute('type') || '';
                let targetRect = rect;

                if (['checkbox', 'radio'].includes(type)) {
                    const label = element.closest('label')
                        || (element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null)
                        || element.closest('th, td');
                    if (label) targetRect = label.getBoundingClientRect();
                }

                return {
                    ok: targetRect.width >= 44 && targetRect.height >= 44,
                    tag: element.tagName.toLowerCase(),
                    type,
                    id: element.id,
                    text: (element.innerText || element.getAttribute('aria-label') || element.value || '').trim().slice(0, 60),
                    width: Math.round(targetRect.width),
                    height: Math.round(targetRect.height)
                };
            }).filter(item => !item.ok).slice(0, 10);

            const modalIssues = Array.from(document.querySelectorAll('.modal')).map(modal => ({
                id: modal.id,
                role: modal.getAttribute('role'),
                ariaModal: modal.getAttribute('aria-modal'),
                label: modal.getAttribute('aria-labelledby') || modal.getAttribute('aria-label')
            })).filter(item => item.role !== 'dialog' || item.ariaModal !== 'true' || !item.label);

            return { rootOverflow, overflowOffenders, smallControls, modalIssues };
        }, { allowedScrollableSelectors });

        const failures = [];
        if (result.rootOverflow > 2) {
            failures.push(`page overflow +${result.rootOverflow}px ${JSON.stringify(result.overflowOffenders)}`);
        }
        if (result.smallControls.length > 0) {
            failures.push(`small touch targets ${JSON.stringify(result.smallControls)}`);
        }
        if (result.modalIssues.length > 0) {
            failures.push(`modal semantics ${JSON.stringify(result.modalIssues)}`);
        }
        if (failures.length > 0) {
            throw new Error(`${label} at ${width}px: ${failures.join('; ')}`);
        }
    }
}

async function auditTeacherStudentModal(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    await page.goto(`${baseUrl}/teacher.html#/teacher/students`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);

    const buttons = page.locator('#student-progress-cards .view-details-btn');
    const count = await buttons.count();
    if (count === 0) return;

    await buttons.first().click();
    await page.waitForSelector('#student-detail-modal:not(.hidden)', { timeout: 5000 });
    const ok = await page.evaluate(() => {
        const modal = document.querySelector('#student-detail-modal');
        if (!modal) return false;
        const before = document.activeElement;
        return modal.getAttribute('role') === 'dialog'
            && modal.getAttribute('aria-modal') === 'true'
            && modal.contains(before);
    });
    if (!ok) throw new Error('Student detail modal did not expose dialog semantics or focus inside the modal.');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('#student-detail-modal')?.classList.contains('hidden'), null, { timeout: 5000 });
}

async function assertStudentActivityCardsAreButtons(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    await page.goto(`${baseUrl}/student.html#/unit/grade6_t1_may_week3_awareness_product`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);

    const result = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.activity-card')).map(card => card.tagName.toLowerCase());
    });
    if (result.length > 0 && result.some(tag => tag !== 'button')) {
        throw new Error(`Activity cards must be buttons. Found: ${result.join(', ')}`);
    }
}

async function main() {
    const { baseUrl, server } = await resolveBaseUrl();
    let browser;

    try {
        browser = await chromium.launch({ headless: true });
        const teacherContext = await browser.newContext();
        const studentContext = await browser.newContext();
        const teacherPage = await teacherContext.newPage();
        const studentPage = await studentContext.newPage();

        await loginTeacher(teacherPage, baseUrl);
        await loginStudent(studentPage, baseUrl);

        const teacherRoutes = [
            ['Teacher Overview', `${baseUrl}/teacher.html#/teacher/overview`],
            ['Teacher Students', `${baseUrl}/teacher.html#/teacher/students`],
            ['Teacher Vocabulary', `${baseUrl}/teacher.html#/teacher/vocabulary`],
            ['Teacher Quizzes', `${baseUrl}/teacher.html#/teacher/quizzes`],
            ['Teacher Data Settings', `${baseUrl}/teacher.html#/teacher/data-settings`]
        ];
        const studentRoutes = [
            ['Student Dashboard', `${baseUrl}/student.html#/menu`],
            ['Student Units', `${baseUrl}/student.html#/units?all=1`],
            ['Student Unit Menu', `${baseUrl}/student.html#/unit/grade6_t1_may_week3_awareness_product`],
            ['Student Flashcards', `${baseUrl}/student.html#/unit/grade6_t1_may_week3_awareness_product/activity/flashcards`],
            ['Student Arcade', `${baseUrl}/student.html#/arcade`]
        ];

        for (const [label, url] of teacherRoutes) {
            await auditRoute(teacherPage, url, label);
        }
        for (const [label, url] of studentRoutes) {
            await auditRoute(studentPage, url, label);
        }

        await auditTeacherStudentModal(teacherPage, baseUrl);
        await assertStudentActivityCardsAreButtons(studentPage, baseUrl);

        console.log(`Responsive UI audit passed across widths: ${widths.join(', ')}`);
    } finally {
        await browser?.close().catch(() => {});
        server?.kill();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exit(1);
});
