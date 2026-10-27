import process from 'node:process';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const widths = [320, 360, 390, 430, 768, 1024, 1280];
const viewportHeight = 900;
const auditUnitId = process.env.UI_AUDIT_ASSIGNMENT_ID ? `assignment.${process.env.UI_AUDIT_ASSIGNMENT_ID}` : 'grade6_t2_august_week1_knowledge_cards';
const requiredEnv = ['UI_AUDIT_TEACHER_EMAIL', 'UI_AUDIT_STUDENT_EMAIL', 'UI_AUDIT_PASSWORD'];
const supabaseOverride = process.env.UI_AUDIT_SUPABASE_URL && process.env.UI_AUDIT_SUPABASE_KEY
    ? {
        url: process.env.UI_AUDIT_SUPABASE_URL,
        publishableKey: process.env.UI_AUDIT_SUPABASE_KEY
    }
    : null;
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

async function resolveBaseUrl() {
    if (process.env.UI_AUDIT_BASE_URL) {
        const baseUrl = process.env.UI_AUDIT_BASE_URL.replace(/\/$/, '');
        const server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', external: true });
        return { baseUrl, server };
    }

    const port = Number(process.env.UI_AUDIT_PORT || 8573);
    const baseUrl = `http://127.0.0.1:${port}`;
    const server = await ensureViteServer({
        baseUrl,
        probePath: '/teacher.html',
        host: '127.0.0.1',
        port
    });

    return { baseUrl, server };
}

async function waitForApp(page) {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(350);
}

async function applySupabaseOverride(context, baseUrl) {
    if (!supabaseOverride) return;
    const target = new URL(supabaseOverride.url);
    if (target.hostname === '127.0.0.1' && target.port !== '54321') {
        await context.grantPermissions(['local-network-access'], { origin: baseUrl });
        await context.route('**/*.html', async route => {
            const response = await route.fetch();
            const body = (await response.text()).replaceAll(':54321', ':' + target.port);
            await route.fulfill({ response, body });
        });
    }
    await context.addInitScript(config => {
        window.SUPABASE_CONFIG = {
            url: config.url,
            publishableKey: config.publishableKey
        };
    }, supabaseOverride);
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

async function auditRoute(page, url, label, options = {}) {
    for (const width of widths) {
        await page.setViewportSize({ width, height: viewportHeight });
        await page.goto(url, { waitUntil: 'load' });
        const shell = url.includes('/teacher.html') ? '#teacher-tab-shell:not(.hidden)' : '#student-tab-shell:not(.hidden)';
        await page.locator(shell).waitFor({ state: 'visible' });
        await waitForApp(page);
        await options.beforeAudit?.(page, width);

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
            ].join(',')))
                .filter(isVisible)
                .filter(element => !allowedScrollableSelectors.some(selector => element.closest(selector)));

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

async function findFirstAssignmentId(page, url, selector) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await page.waitForTimeout(500);
    const cards = page.locator(selector);
    if ((await cards.count()) === 0) return null;
    return cards.first().getAttribute('data-assignment-id').catch(() => null);
}

async function auditTeacherStudentProfile(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    await page.goto(`${baseUrl}/teacher.html#/teacher/overview`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    const home = page.locator('#teacher-overview-view');
    await home.getByRole('button', { name: /^Open class / }).first().click();
    const classes = page.locator('#teacher-classes-view');
    if (process.env.UI_AUDIT_CLASS_ID) await page.getByLabel('Current class', { exact: true }).selectOption(process.env.UI_AUDIT_CLASS_ID);
    await page.locator('#tab-students').click();
    const students = page.locator('#teacher-class-students-view');
    await students.getByRole('button', { name: /^Actions for / }).first().click();
    await page.getByRole('menuitem', { name: 'View profile', exact: true }).click();
    await page.waitForSelector('#teacher-student-profile-view:not(.hidden)', { timeout: 5000 });
    await page.locator('#student-profile-content:not(.hidden)').waitFor();
    const ok = await page.evaluate(() => {
        const profile = document.querySelector('#teacher-student-profile-view');
        return Boolean(profile
            && document.querySelector('#student-profile-back-btn')
            && document.querySelector('.student-profile-tabs[role="tablist"]'));
    });
    if (!ok) throw new Error('Student profile did not expose routed profile navigation and tabs.');

    await page.locator('#student-profile-back-btn').click();
    await page.locator('#tab-students[aria-selected="true"]').waitFor();
    await students.getByRole('button', {name:/^Actions for /}).first().waitFor();
}

async function assertTeacherMobileMenu(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    await page.goto(`${baseUrl}/teacher.html#/teacher/settings`, { waitUntil: 'domcontentloaded' });
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
    if (closedState.label !== 'Settings' || closedState.expanded !== 'false' || !closedState.menuHidden) {
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
    if (openState.expanded !== 'true' || !openState.visible || openState.activeLabel !== 'Settings') {
        throw new Error(`Teacher mobile menu open state is wrong: ${JSON.stringify(openState)}`);
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => {
        const tabs = document.querySelector('#teacher-tabs');
        return document.querySelector('#teacher-mobile-menu-toggle')?.getAttribute('aria-expanded') === 'false'
            && (!tabs || window.getComputedStyle(tabs).display === 'none');
    }, null, { timeout: 5000 });
}

async function assertDataAndSettingsTabs(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    await page.goto(`${baseUrl}/teacher.html#/teacher/settings`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);

    const settingsState = await page.evaluate(() => {
        const visiblePanels = Array.from(document.querySelectorAll('.data-tab-content'))
            .filter(panel => window.getComputedStyle(panel).display !== 'none')
            .map(panel => panel.id);
        const dataView = document.querySelector('#teacher-data-management-view');
        const tabListRect = dataView?.querySelector('.data-tab-list')?.getBoundingClientRect();
        return {
            visibleTabs: Array.from(dataView?.querySelectorAll('.data-tab-btn') || [])
                .filter(button => window.getComputedStyle(button).display !== 'none')
                .map(button => button.dataset.tab),
            selectedTab: dataView?.querySelector('.data-tab-btn[aria-selected="true"]')?.dataset.tab,
            tabListHeight: Math.round(tabListRect?.height || 0),
            visiblePanels
        };
    });

    if (settingsState.visibleTabs.join(',') !== 'subjects,gamification'
        || settingsState.selectedTab !== 'subjects'
        || settingsState.tabListHeight > 72
        || settingsState.visiblePanels.length !== 1
        || settingsState.visiblePanels[0] !== 'data-subjects-section') {
        throw new Error(`Settings did not isolate its controls: ${JSON.stringify(settingsState)}`);
    }

    await page.goto(`${baseUrl}/teacher.html#/teacher/data`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);

    const dataState = await page.evaluate(() => ({
        hash: window.location.hash,
        activeView: document.querySelector('.view.active')?.id,
        activeSection: document.querySelector('.teacher-tab.active')?.dataset.section
    }));

    if (dataState.activeView !== 'teacher-overview-view' || dataState.activeSection !== 'overview') {
        throw new Error(`Legacy Data route did not redirect Home: ${JSON.stringify(dataState)}`);
    }
}

async function assertTeacherSparksRoute(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    await page.goto(`${baseUrl}/teacher.html#/teacher/sparks`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await page.waitForSelector('#teacher-sparks-view:not(.hidden)', { timeout: 5000 });
    await page.locator('#spark-library-list').getByText('Current Audit Spark', { exact: true }).waitFor({ timeout: 10000 });

    const state = await page.evaluate(() => ({
        activeLabel: document.querySelector('.teacher-tab.active')?.textContent?.trim().replace(/\s+/g, ' '),
        mobileLabel: document.querySelector('#teacher-mobile-section-label')?.textContent?.trim(),
        addButtonVisible: Boolean(document.querySelector('#add-spark-btn')),
        currentSparkText: document.querySelector('#spark-library-list')?.textContent || ''
    }));

    if (state.activeLabel !== 'Library'
        || state.mobileLabel !== 'Library'
        || !state.addButtonVisible
        || !state.currentSparkText.includes('Audit Spark')) {
        throw new Error(`Teacher Sparks route did not render expected controls: ${JSON.stringify(state)}`);
    }
}

async function assertStudentSparkCard(page, baseUrl) {
    await page.setViewportSize({ width: 390, height: viewportHeight });
    if (!process.env.UI_AUDIT_SPARK_ASSIGNMENT_ID) throw new Error('Responsive Spark audit needs an assigned fixture.');
    await page.goto(`${baseUrl}/student.html#/sparks?spark=${encodeURIComponent(process.env.UI_AUDIT_SPARK_ASSIGNMENT_ID)}`, { waitUntil: 'domcontentloaded' });
    const spark = page.locator('#student-sparks-view');
    await spark.getByRole('heading', { name: 'Current Audit Spark', exact: true }).waitFor();
    const text = await spark.innerText();
    if (text.includes('Future Audit Spark')) throw new Error('Future class assignments appeared early.');
    await spark.getByLabel('Your answer', { exact: true }).waitFor();
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
        const headerRect = document.querySelector('.student-app-header')?.getBoundingClientRect();

        return {
            toggle,
            coin,
            status,
            profile,
            signOut,
            welcome,
            header: headerRect ? {
                top: Math.round(headerRect.top),
                left: Math.round(headerRect.left),
                right: Math.round(headerRect.right),
                width: Math.round(headerRect.width)
            } : null,
            viewportWidth: window.innerWidth,
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
    if (!closedState.header
        || Math.abs(closedState.header.top) > 1
        || Math.abs(closedState.header.left) > 1
        || Math.abs(closedState.viewportWidth - closedState.header.right) > 1) {
        throw new Error(`Student mobile header must be edge-to-edge: ${JSON.stringify(closedState)}`);
    }
    if (!closedState.coin || !closedState.status || closedState.profile || !closedState.signOut) {
        throw new Error(`Student mobile header must keep coins, status, and sign out visible while hiding profile: ${JSON.stringify(closedState)}`);
    }
    if (Math.abs(closedState.toggle.centerY - closedState.coin.centerY) > 10
        || Math.abs(closedState.toggle.centerY - closedState.status.centerY) > 10
        || Math.abs(closedState.toggle.centerY - closedState.signOut.centerY) > 10) {
        throw new Error(`Student mobile header controls are not aligned on one row: ${JSON.stringify(closedState)}`);
    }
    if (closedState.label !== 'Today' || closedState.expanded !== 'false' || !closedState.menuHidden) {
        throw new Error(`Student mobile menu closed state is wrong: ${JSON.stringify(closedState)}`);
    }

    const dashboardState = await page.evaluate(() => {
        const visible = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        };
        const rectFor = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return {
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                height: Math.round(rect.height),
                width: Math.round(rect.width),
                centerY: Math.round(rect.top + rect.height / 2)
            };
        };
        const visiblePanels = Array.from(document.querySelectorAll('.student-home-panel'))
            .filter(panel => window.getComputedStyle(panel).display !== 'none')
            .map(panel => panel.dataset.panel);
        return {
            headingVisible: visible('.student-dashboard-heading > div:first-child'),
            tabsVisible: visible('.student-home-tabs'),
            activeTab: document.querySelector('.student-home-tab.active')?.dataset.panel,
            visiblePanels,
            helpVisible: visible('.student-top-bar .ember-context-help'),
            visibleClassPickers: ['#student-subject-picker', '#vocab-subject-picker', '#spark-subject-picker'].filter(visible),
            classTrigger: rectFor('#student-subject-picker .student-subject-trigger')
        };
    });

    if (dashboardState.headingVisible
        || !dashboardState.tabsVisible
        || dashboardState.activeTab !== 'week'
        || dashboardState.visiblePanels.length !== 1
        || dashboardState.visiblePanels[0] !== 'week') {
        throw new Error(`Student mobile dashboard is not compacted into one active panel: ${JSON.stringify(dashboardState)}`);
    }
    if (dashboardState.visibleClassPickers.length !== (dashboardState.helpVisible ? 1 : 0)
        || dashboardState.helpVisible && (dashboardState.visibleClassPickers[0] !== '#student-subject-picker'
            || dashboardState.classTrigger?.height < 44 || dashboardState.classTrigger?.width < 44)) {
        throw new Error(`Student help must expose one usable class picker without duplicate page controls: ${JSON.stringify(dashboardState)}`);
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
    await page.goto(`${baseUrl}/student.html#/unit/${auditUnitId}`, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await page.locator('#activity-menu-view.active:not(.hidden)').waitFor();
    await page.locator('#activity-menu-view .activity-card').first().waitFor();

    const result = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.activity-card')).map(card => card.tagName.toLowerCase());
    });
    if (result.length === 0 || result.some(tag => tag !== 'button')) {
        throw new Error(`Activity cards must be buttons. Found: ${result.join(', ')}`);
    }
}

async function main() {
    const { baseUrl, server } = await resolveBaseUrl();
    let browser, arcadeFixture;

    try {
        if (process.env.UI_AUDIT_PREPARE_ARCADE_FIXTURE === '1') {
            const { prepareResponsiveArcadeFixture } = await import('./lib/responsive-arcade-fixture.mjs');
            arcadeFixture = await prepareResponsiveArcadeFixture({ studentId: process.env.UI_AUDIT_STUDENT_ID,
                assignmentId: process.env.UI_AUDIT_ASSIGNMENT_ID, classId: process.env.UI_AUDIT_CLASS_ID });
        }
        browser = await chromium.launch({ headless: true });
        const teacherContext = await browser.newContext({ timezoneId: 'America/Panama' });
        const studentContext = await browser.newContext({ timezoneId: 'America/Panama' });
        await applySupabaseOverride(teacherContext, baseUrl);
        await applySupabaseOverride(studentContext, baseUrl);
        const teacherPage = await teacherContext.newPage();
        const studentPage = await studentContext.newPage();

        if (process.env.UI_AUDIT_DATE) {
            await teacherPage.clock.setFixedTime(new Date(`${process.env.UI_AUDIT_DATE}T15:00:00Z`));
            await studentPage.clock.setFixedTime(new Date(`${process.env.UI_AUDIT_DATE}T15:00:00Z`));
        }
        await loginTeacher(teacherPage, baseUrl);
        await loginStudent(studentPage, baseUrl);

        const teacherRoutes = [
            ['Teacher Overview', `${baseUrl}/teacher.html#/teacher/overview`],
            ['Teacher Students', `${baseUrl}/teacher.html#/teacher/students`],
            ['Teacher Vocabulary', `${baseUrl}/teacher.html#/teacher/vocabulary`],
            ['Teacher Classes', `${baseUrl}/teacher.html#/teacher/classes`],
            ['Teacher Sparks', `${baseUrl}/teacher.html#/teacher/sparks`],
            ['Teacher Quizzes', `${baseUrl}/teacher.html#/teacher/quizzes`],
            ['Teacher Data Redirect', `${baseUrl}/teacher.html#/teacher/data`],
            ['Teacher Settings', `${baseUrl}/teacher.html#/teacher/settings`]
        ];

        const studentRoutes = [
            ['Student Dashboard', `${baseUrl}/student.html#/menu`],
            ['Student Units', `${baseUrl}/student.html#/units?all=1`],
            ['Student Classes', `${baseUrl}/student.html#/classes`],
            ['Student Unit Menu', `${baseUrl}/student.html#/unit/${auditUnitId}`],
            ['Student Flashcards', `${baseUrl}/student.html#/unit/${auditUnitId}/activity/flashcards`],
            ['Student Arcade', `${baseUrl}/student.html#/arcade`, { beforeAudit: async page => {
                await page.locator('#arcade-view.active:not(.hidden) #game-selection:not(.hidden)').waitFor();
                await page.locator('#game-selection .game-card, #game-selection .arcade-game-card').first().waitFor();
            } }]
        ];

        for (const [label, url, options] of teacherRoutes) {
            await auditRoute(teacherPage, url, label, options);
        }
        for (const [label, url, options] of studentRoutes) {
            if (label === 'Student Arcade' && arcadeFixture) {
                // First prove the real incomplete-work gate and teardown. Then
                // prepare an eligible server fixture for actual Arcade geometry.
                await studentPage.goto(url, { waitUntil: 'load' });
                await studentPage.locator('#activity-menu-view.active:not(.hidden)').waitFor();
                await studentPage.waitForFunction(() => !studentApp.activityInstance && !studentApp.currentActivityType
                    && document.querySelectorAll('.ember-help-button').length === 0
                    && document.querySelectorAll('.ember-context-help').length === 1);
                const progressKey = await studentPage.evaluate(() => studentApp.activities.getUnitProgressKey(studentApp.currentVocab));
                if (progressKey !== arcadeFixture.unitKey) throw new Error('Responsive fixture does not match the active assignment progress key.');
                await arcadeFixture.complete();
                await studentPage.reload({ waitUntil: 'load' });
                await studentPage.locator('#student-tab-shell:not(.hidden)').waitFor();
            }
            await auditRoute(studentPage, url, label, options);
        }

        await auditTeacherStudentProfile(teacherPage, baseUrl);
        await assertTeacherMobileMenu(teacherPage, baseUrl);
        await assertDataAndSettingsTabs(teacherPage, baseUrl);
        await assertTeacherSparksRoute(teacherPage, baseUrl);
        await assertStudentMobileMenu(studentPage, baseUrl);
        await assertStudentSparkCard(studentPage, baseUrl);
        await assertStudentActivityCardsAreButtons(studentPage, baseUrl);

        console.log(`Responsive UI audit passed across widths: ${widths.join(', ')}`);
    } finally {
        await browser?.close().catch(() => {});
        try { await arcadeFixture?.restore(); }
        finally { server?.kill(); }
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
});
