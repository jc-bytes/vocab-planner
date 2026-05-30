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

async function assertTeacherMobileMenu(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    await page.goto(`${baseUrl}/teacher.html#/teacher/data-settings`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);

    const closedState = await page.evaluate(() => {
        const visibleRect = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) {
                return null;
            }
            return {
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                centerY: Math.round(rect.top + rect.height / 2)
            };
        };
        const toggle = visibleRect('#teacher-mobile-menu-toggle');
        const status = visibleRect('#teacher-cloud-status');
        const signOut = visibleRect('#teacher-sign-out-btn');
        const menuStyle = window.getComputedStyle(document.querySelector('#teacher-tabs'));

        return {
            toggle,
            status,
            signOut,
            label: document.querySelector('#teacher-mobile-section-label')?.textContent?.trim(),
            expanded: document.querySelector('#teacher-mobile-menu-toggle')?.getAttribute('aria-expanded'),
            menuHidden: menuStyle.display === 'none'
        };
    });

    if (!closedState.toggle || closedState.toggle.height < 44) {
        throw new Error(`Teacher mobile menu toggle is not a 44px visible control: ${JSON.stringify(closedState.toggle)}`);
    }
    if (!closedState.status || !closedState.signOut) {
        throw new Error('Teacher mobile header must keep status dot and sign out visible.');
    }
    if (Math.abs(closedState.toggle.centerY - closedState.status.centerY) > 8
        || Math.abs(closedState.toggle.centerY - closedState.signOut.centerY) > 8) {
        throw new Error(`Teacher mobile header controls are not aligned on one row: ${JSON.stringify(closedState)}`);
    }
    if (closedState.label !== 'Data & Settings' || closedState.expanded !== 'false' || !closedState.menuHidden) {
        throw new Error(`Teacher mobile menu closed state is wrong: ${JSON.stringify(closedState)}`);
    }

    await page.locator('#teacher-mobile-menu-toggle').click();
    await page.waitForTimeout(100);

    const openState = await page.evaluate(() => {
        const tabs = document.querySelector('#teacher-tabs');
        return {
            expanded: document.querySelector('#teacher-mobile-menu-toggle')?.getAttribute('aria-expanded'),
            visible: tabs ? window.getComputedStyle(tabs).display !== 'none' : false,
            activeLabel: document.querySelector('.teacher-tab.active')?.textContent?.trim().replace(/\s+/g, ' ')
        };
    });
    if (openState.expanded !== 'true' || !openState.visible || openState.activeLabel !== 'Data & Settings') {
        throw new Error(`Teacher mobile menu open state is wrong: ${JSON.stringify(openState)}`);
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
        const tabs = document.querySelector('#teacher-tabs');
        return document.querySelector('#teacher-mobile-menu-toggle')?.getAttribute('aria-expanded') === 'false'
            && (!tabs || window.getComputedStyle(tabs).display === 'none');
    }, null, { timeout: 5000 });
}

async function assertDataSettingsUnifiedTabs(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    await page.goto(`${baseUrl}/teacher.html#/teacher/data-settings`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);

    const initialState = await page.evaluate(() => {
        const visiblePanels = Array.from(document.querySelectorAll('.data-tab-content'))
            .filter(panel => window.getComputedStyle(panel).display !== 'none')
            .map(panel => panel.id);
        const tabListRect = document.querySelector('.data-tab-list')?.getBoundingClientRect();
        return {
            tabCount: document.querySelectorAll('.data-tab-btn').length,
            selectedTab: document.querySelector('.data-tab-btn[aria-selected="true"]')?.dataset.tab,
            tabListHeight: Math.round(tabListRect?.height || 0),
            visiblePanels
        };
    });

    if (initialState.tabCount !== 7
        || initialState.selectedTab !== 'subjects'
        || initialState.tabListHeight > 72
        || initialState.visiblePanels.length !== 1
        || initialState.visiblePanels[0] !== 'data-subjects-section') {
        throw new Error(`Data & Settings should default to one unified Subjects tab: ${JSON.stringify(initialState)}`);
    }

    await page.locator('#data-tab-dashboard').click();
    await page.waitForTimeout(100);

    const dashboardState = await page.evaluate(() => {
        const visiblePanels = Array.from(document.querySelectorAll('.data-tab-content'))
            .filter(panel => window.getComputedStyle(panel).display !== 'none')
            .map(panel => panel.id);
        return {
            selectedTab: document.querySelector('.data-tab-btn[aria-selected="true"]')?.dataset.tab,
            visiblePanels
        };
    });

    if (dashboardState.selectedTab !== 'dashboard'
        || dashboardState.visiblePanels.length !== 1
        || dashboardState.visiblePanels[0] !== 'data-dashboard-section') {
        throw new Error(`Data & Settings dashboard tab did not isolate its panel: ${JSON.stringify(dashboardState)}`);
    }
}

async function assertStudentMobileMenu(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    await page.goto(`${baseUrl}/student.html#/menu`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await page.waitForSelector('#student-tab-shell:not(.hidden)', { timeout: 5000 });
    await page.evaluate(() => {
        document.querySelector('.student-app-header')?.classList.remove('student-mobile-compact');
    });
    await page.waitForTimeout(50);

    const closedState = await page.evaluate(() => {
        const visibleRect = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) {
                return null;
            }
            return {
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                centerY: Math.round(rect.top + rect.height / 2)
            };
        };
        const toggle = visibleRect('#student-mobile-menu-toggle');
        const coin = visibleRect('#coin-balance');
        const status = visibleRect('#auth-status');
        const profile = visibleRect('#mobile-edit-profile-btn');
        const signOut = visibleRect('#sign-out-btn');
        const welcome = visibleRect('#welcome-header');
        const menuStyle = window.getComputedStyle(document.querySelector('#student-tabs'));

        return {
            toggle,
            coin,
            status,
            profile,
            signOut,
            welcome,
            label: document.querySelector('#student-mobile-section-label')?.textContent?.trim(),
            expanded: document.querySelector('#student-mobile-menu-toggle')?.getAttribute('aria-expanded'),
            menuHidden: menuStyle.display === 'none'
        };
    });

    if (!closedState.toggle || closedState.toggle.height < 44) {
        throw new Error(`Student mobile menu toggle is not a 44px visible control: ${JSON.stringify(closedState.toggle)}`);
    }
    if (closedState.welcome) {
        throw new Error(`Student mobile header should hide the large name row: ${JSON.stringify(closedState)}`);
    }
    if (!closedState.coin || !closedState.status || !closedState.profile || !closedState.signOut) {
        throw new Error(`Student mobile header must keep coins, status, profile, and sign out visible: ${JSON.stringify(closedState)}`);
    }
    if (Math.abs(closedState.toggle.centerY - closedState.coin.centerY) > 10
        || Math.abs(closedState.toggle.centerY - closedState.status.centerY) > 10
        || Math.abs(closedState.toggle.centerY - closedState.profile.centerY) > 10
        || Math.abs(closedState.toggle.centerY - closedState.signOut.centerY) > 10) {
        throw new Error(`Student mobile header controls are not aligned on one row: ${JSON.stringify(closedState)}`);
    }
    if (closedState.label !== 'Today' || closedState.expanded !== 'false' || !closedState.menuHidden) {
        throw new Error(`Student mobile menu closed state is wrong: ${JSON.stringify(closedState)}`);
    }

    await page.locator('#student-mobile-menu-toggle').click();
    await page.waitForTimeout(100);

    const openState = await page.evaluate(() => {
        const tabs = document.querySelector('#student-tabs');
        return {
            expanded: document.querySelector('#student-mobile-menu-toggle')?.getAttribute('aria-expanded'),
            visible: tabs ? window.getComputedStyle(tabs).display !== 'none' : false,
            activeLabel: document.querySelector('.student-tab.active')?.textContent?.trim().replace(/\s+/g, ' ')
        };
    });
    if (openState.expanded !== 'true' || !openState.visible || openState.activeLabel !== 'Today') {
        throw new Error(`Student mobile menu open state is wrong: ${JSON.stringify(openState)}`);
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
        const tabs = document.querySelector('#student-tabs');
        return document.querySelector('#student-mobile-menu-toggle')?.getAttribute('aria-expanded') === 'false'
            && (!tabs || window.getComputedStyle(tabs).display === 'none');
    }, null, { timeout: 5000 });
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
        await assertTeacherMobileMenu(teacherPage, baseUrl);
        await assertDataSettingsUnifiedTabs(teacherPage, baseUrl);
        await assertStudentMobileMenu(studentPage, baseUrl);
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
