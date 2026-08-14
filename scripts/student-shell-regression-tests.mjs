import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const host = '127.0.0.1';
const port = Number(process.env.STUDENT_SHELL_TEST_PORT || 8016);
const baseUrl = (process.env.STUDENT_SHELL_TEST_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');
const snapshotDir = process.env.STUDENT_SHELL_SNAPSHOT_DIR || '';
const viewportHeight = 900;
const widths = [1280, 1121, 1120, 1024, 901, 900, 768, 390, 320];
const views = [
    ['Today', 'main-menu-view'],
    ['Vocabulary', 'vocab-selection-view'],
    ['Activity menu', 'activity-menu-view'],
    ['Activity view', 'activity-view'],
    ['Arcade', 'arcade-view']
];

function requestOk(url) {
    return new Promise(resolve => {
        const request = http.get(url, response => {
            response.resume();
            resolve(response.statusCode >= 200 && response.statusCode < 400);
        });
        request.on('error', () => resolve(false));
        request.setTimeout(1000, () => {
            request.destroy();
            resolve(false);
        });
    });
}

async function waitForServer(url, timeoutMs = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await requestOk(url)) return true;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
}

async function resolveServer() {
    if (process.env.STUDENT_SHELL_TEST_BASE_URL) {
        if (!(await waitForServer(`${baseUrl}/student.html`, 3000))) {
            throw new Error(`STUDENT_SHELL_TEST_BASE_URL is not reachable: ${baseUrl}`);
        }
        return null;
    }

    if (await requestOk(`${baseUrl}/student.html`)) return null;
    const server = spawn('npx', ['vite', '--host', host, '--port', String(port), '--strictPort'], {
        cwd: process.cwd(),
        stdio: 'ignore'
    });
    if (!(await waitForServer(`${baseUrl}/student.html`))) {
        server.kill();
        throw new Error(`Could not start student shell test server at ${baseUrl}`);
    }
    return server;
}

async function installFixture(page) {
    await page.goto(`${baseUrl}/student.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.studentApp?.activities?.manifest?.vocabularies?.length, null, { timeout: 15000 });
    await page.evaluate(async () => {
        const app = window.studentApp;
        const source = app.activities.manifest.vocabularies.find(vocab => {
            return String(vocab.grade) === '6' || vocab.grades?.some(grade => String(grade) === '6');
        }) || app.activities.manifest.vocabularies[0];

        app.authDisabled = true;
        app.currentUser = { id: 'student-shell-regression' };
        app.studentProfile.grade = String(source.grade || source.grades?.[0] || '6');
        app.subjects = [
            { slug: 'technology', name: 'Technology', color: '#adc6ff', active: true },
            { slug: 'science', name: 'Science', color: '#7ee787', active: true }
        ];
        app.activities.cloudVocabs = [{
            ...source,
            id: 'student-shell-regression-science',
            name: 'Student Shell Science Fixture',
            subjectSlug: 'science',
            __source: 'cloud'
        }];
        app.selectedSubjectSlug = 'technology';
        localStorage.setItem('student_selected_subject', 'technology');
        app.activities.renderDashboard();
        await app.activities.renderStudentHome();
        await app.activities.loadVocabulary(source, { fromRoute: true });

        const style = document.createElement('style');
        style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
        document.head.appendChild(style);
    });
}

async function readShellState(page, width, view) {
    return page.evaluate(({ width, view }) => {
        const isVisible = element => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none'
                && style.visibility !== 'hidden'
                && rect.width > 0
                && rect.height > 0;
        };
        const roundRect = element => {
            const rect = element.getBoundingClientRect();
            return [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 100) / 100);
        };

        const app = document.querySelector('.app-container');
        const header = document.querySelector('.student-app-header');
        const main = document.querySelector('.app-container > main');
        const sidebarPicker = document.querySelector('#student-subject-picker');
        const pagePicker = document.querySelector('#vocab-subject-picker');
        const toggle = document.querySelector('#student-mobile-menu-toggle');
        const tabs = document.querySelector('#student-tabs');
        const activityChoices = [...document.querySelectorAll('#activity-menu-view [data-activity]')];
        const appStyle = window.getComputedStyle(app);
        const mainStyle = window.getComputedStyle(main);
        const hiddenControls = [
            sidebarPicker.querySelector('select'),
            pagePicker.querySelector('select'),
            toggle,
            ...tabs.querySelectorAll('button')
        ].filter(Boolean).filter(control => !isVisible(control));
        const hiddenControlsRejectFocus = hiddenControls.every(control => {
            control.focus();
            return document.activeElement !== control;
        });
        document.activeElement?.blur();

        return {
            width,
            view,
            compactClass: header.classList.contains('student-mobile-compact'),
            app: {
                rect: roundRect(app),
                display: appStyle.display,
                columns: appStyle.gridTemplateColumns,
                gap: appStyle.gap
            },
            header: {
                rect: roundRect(header),
                position: window.getComputedStyle(header).position
            },
            main: {
                rect: roundRect(main),
                marginLeft: mainStyle.marginLeft,
                gridColumn: mainStyle.gridColumn
            },
            pagePickerVisible: isVisible(pagePicker),
            sidebarPickerVisible: isVisible(sidebarPicker),
            toggleVisible: isVisible(toggle),
            tabsVisible: isVisible(tabs),
            hiddenControlIds: hiddenControls.map(control => control.id),
            hiddenControlsRejectFocus,
            heights: {
                toggle: Math.round(toggle.getBoundingClientRect().height),
                pagePicker: Math.round(pagePicker.getBoundingClientRect().height),
                sidebarPicker: Math.round(sidebarPicker.getBoundingClientRect().height)
            },
            activityMenu: {
                choiceCount: activityChoices.length,
                visibleChoiceCount: activityChoices.filter(isVisible).length,
                enabledChoiceCount: activityChoices.filter(choice => isVisible(choice) && !choice.disabled).length,
                elementsPastRightEdge: [...document.querySelectorAll('#activity-menu-view *')]
                    .filter(isVisible)
                    .filter(element => element.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5)
                    .map(element => element.id || element.className || element.tagName)
            },
            overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
        };
    }, { width, view });
}

function assertShellState(state) {
    const compact = state.width <= 1120;
    const vocabulary = state.view === 'Vocabulary';
    const arcade = state.view === 'Arcade';
    const failures = [];

    if (compact) {
        if (!state.compactClass) failures.push('compact class is absent');
        if (state.header.position !== 'sticky' || state.header.rect[0] !== 0 || state.header.rect[2] !== state.width) {
            failures.push(`compact header geometry ${JSON.stringify(state.header)}`);
        }
        if (state.main.rect[0] !== 0 || state.main.marginLeft !== '0px') failures.push(`compact rail ${JSON.stringify(state.main)}`);
        if (state.sidebarPickerVisible) failures.push('compact sidebar picker is visible');
        if (!state.toggleVisible || state.tabsVisible) failures.push('compact navigation ownership is wrong');
        if (vocabulary !== state.pagePickerVisible) failures.push('compact page picker ownership is wrong');
        if (state.heights.toggle !== 44) failures.push(`compact toggle height ${state.heights.toggle}`);
        if (vocabulary && state.heights.pagePicker !== 44) failures.push(`compact picker height ${state.heights.pagePicker}`);
    } else {
        if (state.compactClass) failures.push('compact class remains active in wide shell');
        if (state.header.position !== 'fixed' || state.header.rect[0] !== 0 || state.header.rect[2] !== 256) {
            failures.push(`wide sidebar geometry ${JSON.stringify(state.header)}`);
        }
        if (!state.sidebarPickerVisible || state.pagePickerVisible) failures.push('wide picker ownership is wrong');
        if (state.toggleVisible || !state.tabsVisible) failures.push('wide navigation ownership is wrong');
        if (state.heights.sidebarPicker !== 52) failures.push(`wide picker height ${state.heights.sidebarPicker}`);

        if (arcade) {
            if (state.app.display !== 'grid'
                || !state.app.columns.startsWith('260px ')
                || state.app.gap !== '32px'
                || state.main.gridColumn !== '2'
                || state.main.marginLeft !== '0px'
                || state.main.rect[0] !== 292) {
                failures.push(`Arcade wide ownership ${JSON.stringify({ app: state.app, main: state.main })}`);
            }
        } else if (state.main.rect[0] !== 256 || state.main.marginLeft !== '256px') {
            failures.push(`normal wide rail ${JSON.stringify(state.main)}`);
        }
    }

    if (vocabulary && Number(state.pagePickerVisible) + Number(state.sidebarPickerVisible) !== 1) {
        failures.push('Vocabulary does not have exactly one visible subject picker');
    }
    if (!state.hiddenControlsRejectFocus) failures.push('a hidden shell control accepted programmatic focus');

    if (state.view === 'Activity menu') {
        if (state.activityMenu.choiceCount !== 12 || state.activityMenu.visibleChoiceCount !== 12) {
            failures.push(`Activity choices are missing: ${JSON.stringify(state.activityMenu)}`);
        }
        if (state.activityMenu.enabledChoiceCount < 1) failures.push('Activity menu has no enabled activity choice');
        if (state.activityMenu.elementsPastRightEdge.length) {
            failures.push(`Activity elements extend past the viewport: ${state.activityMenu.elementsPastRightEdge.join(', ')}`);
        }
    }

    if (state.overflow !== 0) {
        failures.push(`document overflow changed: expected 0px, got ${state.overflow}px`);
    }

    if (failures.length) {
        throw new Error(`${state.view} at ${state.width}px: ${failures.join('; ')}`);
    }
}

async function assertNarrowActivityControlsReachable(page, width) {
    const controls = await page.evaluate(() => {
        const candidates = [
            document.querySelector('#back-to-vocab'),
            document.querySelector('#student-vocab-export-menu summary'),
            ...document.querySelectorAll('#activity-menu-view [data-activity]:not(:disabled)')
        ].filter(Boolean);
        return candidates.map((control, index) => {
            const auditId = `activity-control-${index}`;
            control.dataset.activityAuditId = auditId;
            control.scrollIntoView({ block: 'center' });
            const rect = control.getBoundingClientRect();
            const target = document.elementFromPoint(
                Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2)),
                Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2))
            );
            control.focus();
            return {
                auditId,
                acceptsFocus: document.activeElement === control,
                pointerTarget: Boolean(target && (target === control || control.contains(target))),
                width: rect.width,
                height: rect.height
            };
        });
    });
    const unusable = controls.filter(control => (
        !control.acceptsFocus
        || !control.pointerTarget
    ));
    if (unusable.length) {
        throw new Error(`Activity menu at ${width}px has unreachable controls: ${JSON.stringify(unusable)}`);
    }

    await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.activeElement?.blur();
    });
    const tabbed = new Set();
    for (let index = 0; index < 80; index += 1) {
        await page.keyboard.press('Tab');
        const auditId = await page.evaluate(() => document.activeElement?.dataset?.activityAuditId || '');
        if (auditId) tabbed.add(auditId);
    }
    const missingFromTabOrder = controls.filter(control => !tabbed.has(control.auditId));
    if (missingFromTabOrder.length) {
        throw new Error(`Activity menu at ${width}px has controls outside Tab order: ${JSON.stringify(missingFromTabOrder)}`);
    }
}

async function assertHiddenControlsOutsideTabOrder(page, state) {
    const seen = [];
    await page.evaluate(() => document.activeElement?.blur());
    for (let index = 0; index < 45; index += 1) {
        await page.keyboard.press('Tab');
        seen.push(await page.evaluate(() => document.activeElement?.id || ''));
    }
    const hiddenSeen = state.hiddenControlIds.filter(id => seen.includes(id));
    if (hiddenSeen.length) {
        throw new Error(`${state.view} at ${state.width}px: hidden controls entered Tab order: ${hiddenSeen.join(', ')}`);
    }
}

async function assertResizeTransition(page) {
    await page.evaluate(() => window.studentApp.switchView('vocab-selection-view'));
    for (const width of [1120, 1121, 1120]) {
        await page.setViewportSize({ width, height: viewportHeight });
        await page.waitForTimeout(180);
        const state = await readShellState(page, width, 'Vocabulary');
        assertShellState(state);
    }
}

let server = null;
let browser = null;
const browserProblems = [];
const manifest = {};

try {
    if (snapshotDir) {
        fs.mkdirSync(snapshotDir, { recursive: true });
    }

    server = await resolveServer();
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: viewportHeight } });
    await context.addInitScript(() => {
        window.SUPABASE_CONFIG = {
            url: 'http://127.0.0.1:59999',
            publishableKey: 'student-shell-regression-key'
        };
    });
    const page = await context.newPage();
    page.on('console', message => {
        if (message.type() === 'error') browserProblems.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', error => browserProblems.push(`pageerror: ${error.message}`));
    await installFixture(page);

    for (const width of widths) {
        await page.setViewportSize({ width, height: viewportHeight });
        for (const [view, viewId] of views) {
            await page.evaluate(id => window.studentApp.switchView(id), viewId);
            await page.waitForTimeout(120);
            const state = await readShellState(page, width, view);
            assertShellState(state);
            if (view === 'Vocabulary') await assertHiddenControlsOutsideTabOrder(page, state);
            if (view === 'Activity menu' && width <= 390) {
                await assertNarrowActivityControlsReachable(page, width);
            }
            const key = `${width}-${view.toLowerCase()}`;
            manifest[key] = state;
            if (snapshotDir) {
                await page.screenshot({ path: path.join(snapshotDir, `${key}.png`), animations: 'disabled' });
            }
        }
    }

    await assertResizeTransition(page);
    if (browserProblems.length) {
        throw new Error(`Student shell audit emitted browser errors:\n${browserProblems.join('\n')}`);
    }
    if (snapshotDir) {
        fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }
    console.log(`Student shell regression tests passed for ${widths.length} widths, ${views.length} views, and the 1120px ↔ 1121px transition.`);
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
