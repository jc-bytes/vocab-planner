import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
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
    ['Sparks', 'student-sparks-view'],
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
        await app.activities.renderSparkLibrary();
        await app.activities.loadVocabulary(source, { fromRoute: true });

        const style = document.createElement('style');
        style.textContent = 'html body .app-container{--student-sidebar-transition-duration:0ms!important}*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
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
        const topbar = document.querySelector('.student-top-bar');
        const main = document.querySelector('.app-container > main');
        const activeView = main?.querySelector(':scope > .view.active:not(.hidden)');
        const sidebarPicker = document.querySelector('#student-subject-picker');
        const vocabularyPicker = document.querySelector('#vocab-subject-picker');
        const sparkPicker = document.querySelector('#spark-subject-picker');
        const vocabularyGrid = document.querySelector('#vocab-selection-view .trimester-vocab-grid');
        const pagePicker = view === 'Sparks' ? sparkPicker : vocabularyPicker;
        const toggle = document.querySelector('#student-mobile-menu-toggle');
        const tabs = document.querySelector('#student-tabs');
        const activityChoices = [...document.querySelectorAll('#activity-menu-view [data-activity]')];
        const sparkTitle = document.querySelector('#student-sparks-view .page-header__title');
        const sparkLibrary = document.querySelector('#student-sparks-library');
        const appStyle = window.getComputedStyle(app);
        const headerStyle = window.getComputedStyle(header);
        const topbarStyle = window.getComputedStyle(topbar);
        const mainStyle = window.getComputedStyle(main);
        const activeViewStyle = activeView ? window.getComputedStyle(activeView) : null;
        const hiddenControls = [
            sidebarPicker.querySelector('.student-subject-trigger'),
            vocabularyPicker.querySelector('.student-subject-trigger'),
            sparkPicker.querySelector('.student-subject-trigger'),
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
            viewportHeight: window.innerHeight,
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
                position: headerStyle.position,
                backgroundColor: headerStyle.backgroundColor,
                borderRightWidth: headerStyle.borderRightWidth,
                boxShadow: headerStyle.boxShadow
            },
            topbar: {
                visible: isVisible(topbar),
                rect: roundRect(topbar),
                backgroundColor: topbarStyle.backgroundColor,
                boxShadow: topbarStyle.boxShadow,
                statusWidth: Math.round(document.querySelector('.student-top-bar .student-identity')?.getBoundingClientRect().width || 0),
                trackWidth: Math.round(document.querySelector('.student-top-bar .student-xp-track')?.getBoundingClientRect().width || 0)
            },
            main: {
                rect: roundRect(main),
                marginLeft: mainStyle.marginLeft,
                gridColumn: mainStyle.gridColumn,
                borderRadius: mainStyle.borderRadius,
                overflowY: mainStyle.overflowY
            },
            activeView: {
                id: activeView?.id || '',
                rect: activeView ? roundRect(activeView) : [0, 0, 0, 0],
                overflowY: activeViewStyle?.overflowY || ''
            },
            pagePickerVisible: isVisible(pagePicker),
            vocabularyGridColumns: isVisible(vocabularyGrid)
                ? window.getComputedStyle(vocabularyGrid).gridTemplateColumns.split(/\s+/).filter(Boolean).length
                : 0,
            sidebarPickerVisible: isVisible(sidebarPicker),
            pickerInTopbar: topbar.contains(sidebarPicker),
            sparkAlignment: {
                titleLeft: sparkTitle ? Math.round(sparkTitle.getBoundingClientRect().left) : 0,
                contentLeft: sparkLibrary
                    ? Math.round(sparkLibrary.getBoundingClientRect().left + Math.max(0, (sparkLibrary.getBoundingClientRect().width - 980) / 2))
                    : 0
            },
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
            overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
            verticalOverflow: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
        };
    }, { width, view });
}

function assertShellState(state) {
    const compact = state.width <= 1120;
    const vocabulary = state.view === 'Vocabulary';
    const subjectPage = vocabulary || state.view === 'Sparks';
    const arcade = state.view === 'Arcade';
    const failures = [];

    if (compact) {
        if (!state.compactClass) failures.push('compact class is absent');
        if (state.header.position !== 'sticky' || state.header.rect[0] !== 0 || state.header.rect[2] !== state.width) {
            failures.push(`compact header geometry ${JSON.stringify(state.header)}`);
        }
        if (state.main.rect[0] !== 0 || state.main.marginLeft !== '0px') failures.push(`compact rail ${JSON.stringify(state.main)}`);
        if (state.topbar.visible) failures.push('wide identity top bar is visible in compact shell');
        if (state.sidebarPickerVisible) failures.push('compact sidebar picker is visible');
        if (!state.toggleVisible || state.tabsVisible) failures.push('compact navigation ownership is wrong');
        if (subjectPage !== state.pagePickerVisible) failures.push('compact page picker ownership is wrong');
        if (state.heights.toggle !== 44) failures.push(`compact toggle height ${state.heights.toggle}`);
        if (subjectPage && state.heights.pagePicker !== 44) failures.push(`compact picker height ${state.heights.pagePicker}`);
    } else {
        if (state.compactClass) failures.push('compact class remains active in wide shell');
        if (state.header.position !== 'fixed' || state.header.rect[0] !== 0 || state.header.rect[2] !== 240) {
            failures.push(`wide sidebar geometry ${JSON.stringify(state.header)}`);
        }
        if (!state.topbar.visible
            || state.topbar.rect[0] !== 240
            || state.topbar.rect[1] !== 0
            || state.topbar.rect[2] !== state.width - 240
            || state.topbar.rect[3] !== 52) {
            failures.push(`wide top bar geometry ${JSON.stringify(state.topbar)}`);
        }
        if (state.header.backgroundColor !== state.topbar.backgroundColor
            || state.header.borderRightWidth !== '0px'
            || state.header.boxShadow !== 'none'
            || state.topbar.boxShadow !== 'none') {
            failures.push(`sidebar/top-bar seam ${JSON.stringify({ header: state.header, topbar: state.topbar })}`);
        }
        if (state.topbar.statusWidth > 448 || state.topbar.trackWidth > 288) {
            failures.push(`top-bar status cluster is too wide ${JSON.stringify(state.topbar)}`);
        }
        if (!state.sidebarPickerVisible || state.pagePickerVisible) failures.push('wide picker ownership is wrong');
        if (!state.pickerInTopbar) failures.push('wide class context is not in the top bar');
        if (state.toggleVisible || !state.tabsVisible) failures.push('wide navigation ownership is wrong');
        if (state.heights.sidebarPicker !== 44) failures.push(`wide picker height ${state.heights.sidebarPicker}`);
        if (state.main.rect[1] !== 52 || state.main.borderRadius !== '22px') {
            failures.push(`rounded content surface ${JSON.stringify(state.main)}`);
        }
        if (state.main.rect[1] + state.main.rect[3] !== state.viewportHeight - 12
            || state.main.overflowY !== 'hidden'
            || state.activeView.overflowY !== 'auto'
            || state.activeView.rect[3] <= 0
            || state.activeView.rect[1] < state.main.rect[1]
            || state.activeView.rect[1] + state.activeView.rect[3] > state.main.rect[1] + state.main.rect[3]) {
            failures.push(`inner content scroll ownership ${JSON.stringify({ main: state.main, activeView: state.activeView })}`);
        }
        if (vocabulary && state.vocabularyGridColumns > 0 && state.vocabularyGridColumns !== 4) {
            failures.push(`desktop vocabulary grid has ${state.vocabularyGridColumns} columns instead of 4`);
        }
        if (state.verticalOverflow !== 0) {
            failures.push(`wide document scroll changed: expected 0px, got ${state.verticalOverflow}px`);
        }
        if (state.view === 'Sparks' && state.sparkAlignment.titleLeft !== state.sparkAlignment.contentLeft) {
            failures.push(`Sparks title/content alignment ${JSON.stringify(state.sparkAlignment)}`);
        }

        if (arcade) {
            if (state.app.display !== 'block'
                || state.main.marginLeft !== '252px'
                || state.main.rect[0] !== 252) {
                failures.push(`Arcade wide ownership ${JSON.stringify({ app: state.app, main: state.main })}`);
            }
        } else if (state.main.rect[0] !== 252 || state.main.marginLeft !== '252px') {
            failures.push(`normal wide rail ${JSON.stringify(state.main)}`);
        }
    }

    if (subjectPage && Number(state.pagePickerVisible) + Number(state.sidebarPickerVisible) !== 1) {
        failures.push(`${state.view} does not have exactly one visible subject picker`);
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

async function assertCollapsedSidebar(page) {
    await page.setViewportSize({ width: 1280, height: viewportHeight });
    await page.evaluate(() => window.studentApp.switchView('main-menu-view'));
    const expandedAccount = await page.evaluate(() => {
        const top = selector => Math.round(document.querySelector(selector)?.getBoundingClientRect().top || 0);
        const center = selector => {
            const bounds = document.querySelector(selector)?.getBoundingClientRect();
            return [Math.round((bounds?.left || 0) + (bounds?.width || 0) / 2), Math.round((bounds?.top || 0) + (bounds?.height || 0) / 2)];
        };
        return {
            coinTop: top('#coin-balance'),
            logoutTop: top('#sign-out-btn'),
            coinLabel: document.querySelector('.student-coin-label')?.textContent?.trim(),
            coinAlignment: window.getComputedStyle(document.querySelector('#coin-balance')).justifyContent,
            toggleWidth: Math.round(document.querySelector('#student-sidebar-toggle')?.getBoundingClientRect().width || 0),
            toggleHeight: Math.round(document.querySelector('#student-sidebar-toggle')?.getBoundingClientRect().height || 0),
            toggleIconCenter: center('#student-sidebar-toggle svg'),
            activeNavIconCenter: center('.student-tab.active svg')
        };
    });
    assert.ok(expandedAccount.coinTop > 700, `expanded account controls are not in the lower rail: ${JSON.stringify(expandedAccount)}`);
    assert.ok(expandedAccount.logoutTop > expandedAccount.coinTop, `coins and logout are not in separate rows: ${JSON.stringify(expandedAccount)}`);
    assert.equal(expandedAccount.coinLabel, 'Coins');
    assert.equal(expandedAccount.coinAlignment, 'flex-start');
    assert.equal(expandedAccount.toggleWidth, 44);
    assert.equal(expandedAccount.toggleHeight, 44);

    await page.click('#student-sidebar-toggle');
    await page.waitForTimeout(120);

    const collapsed = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
        const headerRect = rect('.student-app-header');
        const mainRect = rect('.app-container > main');
        const topbarRect = rect('.student-top-bar');
        const toggle = document.querySelector('#student-sidebar-toggle');
        const center = selector => {
            const bounds = rect(selector);
            return [Math.round((bounds?.left || 0) + (bounds?.width || 0) / 2), Math.round((bounds?.top || 0) + (bounds?.height || 0) / 2)];
        };
        return {
            active: document.querySelector('.app-container')?.classList.contains('student-sidebar-collapsed'),
            stored: localStorage.getItem('student_sidebar_collapsed'),
            headerWidth: Math.round(headerRect?.width || 0),
            mainX: Math.round(mainRect?.x || 0),
            topbarX: Math.round(topbarRect?.x || 0),
            label: toggle?.getAttribute('aria-label'),
            iconPresent: Boolean(toggle?.querySelector('svg')),
            toggleWidth: Math.round(toggle?.getBoundingClientRect().width || 0),
            toggleHeight: Math.round(toggle?.getBoundingClientRect().height || 0),
            navLabels: [...document.querySelectorAll('.student-tab')].map(tab => tab.getAttribute('aria-label')),
            coinTop: Math.round(document.querySelector('#coin-balance')?.getBoundingClientRect().top || 0),
            logoutTop: Math.round(document.querySelector('#sign-out-btn')?.getBoundingClientRect().top || 0),
            toggleIconCenter: center('#student-sidebar-toggle svg'),
            activeNavIconCenter: center('.student-tab.active svg'),
            overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
        };
    });
    assert.deepEqual({
        ...collapsed,
        navLabels: collapsed.navLabels.slice(0, 3),
        coinTop: 0,
        logoutTop: 0,
        toggleIconCenter: [0, 0],
        activeNavIconCenter: [0, 0]
    }, {
        active: true,
        stored: 'true',
        headerWidth: 76,
        mainX: 88,
        topbarX: 76,
        label: 'Expand navigation',
        iconPresent: true,
        toggleWidth: 44,
        toggleHeight: 44,
        navLabels: ['Today', 'Vocabulary', 'Sparks'],
        coinTop: 0,
        logoutTop: 0,
        toggleIconCenter: [0, 0],
        activeNavIconCenter: [0, 0],
        overflow: 0
    });
    assert.match(collapsed.navLabels[3], /^Arcade/);
    assert.ok(collapsed.coinTop > 700, `collapsed coins are not in the lower rail: ${collapsed.coinTop}`);
    assert.ok(collapsed.logoutTop > collapsed.coinTop, `collapsed logout is not below coins: ${JSON.stringify(collapsed)}`);
    assert.ok(
        Math.abs(collapsed.toggleIconCenter[0] - expandedAccount.toggleIconCenter[0]) <= 1
            && collapsed.toggleIconCenter[1] === expandedAccount.toggleIconCenter[1],
        `collapse control moved between rail states: ${JSON.stringify({ expanded: expandedAccount.toggleIconCenter, collapsed: collapsed.toggleIconCenter })}`
    );
    assert.ok(
        Math.abs(collapsed.activeNavIconCenter[0] - expandedAccount.activeNavIconCenter[0]) <= 1
            && collapsed.activeNavIconCenter[1] === expandedAccount.activeNavIconCenter[1],
        `active navigation icon moved between rail states: ${JSON.stringify({ expanded: expandedAccount.activeNavIconCenter, collapsed: collapsed.activeNavIconCenter })}`
    );
    if (snapshotDir) {
        await page.screenshot({ path: path.join(snapshotDir, '1280-collapsed-sidebar.png'), animations: 'disabled' });
    }

    await page.evaluate(() => window.studentApp.switchView('arcade-view'));
    await page.waitForTimeout(120);
    const arcade = await page.evaluate(() => {
        const app = document.querySelector('.app-container');
        const main = document.querySelector('.app-container > main');
        return {
            columns: window.getComputedStyle(app).gridTemplateColumns,
            mainX: Math.round(main.getBoundingClientRect().x)
        };
    });
    assert.equal(arcade.columns, 'none');
    assert.equal(arcade.mainX, 88);

    await page.click('#student-sidebar-toggle');
    await page.waitForTimeout(120);
}

async function assertStudentDesignSystem(page, width, view) {
    if (view === 'Activity view' || view === 'Arcade') return;

    const state = await page.evaluate(currentView => {
        const visibleControls = [...document.querySelectorAll('.view:not(.hidden) .btn, .view:not(.hidden) button')]
            .filter(control => {
                const style = window.getComputedStyle(control);
                return style.display !== 'none' && style.visibility !== 'hidden' && control.getBoundingClientRect().width > 0;
            });
        const titleSelector = {
            Today: '.student-dashboard-heading h2',
            Vocabulary: '#vocab-selection-view .page-header__title',
            Sparks: '#student-sparks-view .page-header__title',
            'Activity menu': '#activity-menu-view .activity-menu-title-block > h2'
        }[currentView];
        const title = titleSelector ? document.querySelector(titleSelector) : null;
        return {
            bodyFont: window.getComputedStyle(document.body).fontFamily,
            designSheetLoaded: [...document.styleSheets].some(sheet => sheet.href?.includes('student-design-system.css')),
            titleSize: title ? Number.parseFloat(window.getComputedStyle(title).fontSize) : null,
            undersizedControls: visibleControls
                .map(control => ({
                    label: control.getAttribute('aria-label') || control.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
                    height: Math.round(control.getBoundingClientRect().height)
                }))
                .filter(control => control.height < 44)
        };
    }, view);

    assert.equal(state.designSheetLoaded, true, 'student design-system stylesheet is not loaded');
    assert.match(state.bodyFont, /^Inter,/, `student UI is not using Inter: ${state.bodyFont}`);
    assert.deepEqual(state.undersizedControls, [], `controls below 44px at ${width}px in ${view}: ${JSON.stringify(state.undersizedControls)}`);

    if (view === 'Today' && width > 700) {
        assert.ok(state.titleSize >= 32 && state.titleSize <= 48, `Today display title is outside the approved scale: ${state.titleSize}px`);
    } else if (view !== 'Today') {
        assert.equal(state.titleSize, 24, `${view} page title must use the 24px page-title role`);
    }
}

async function assertCompactTodaySupportRow(page) {
    await page.setViewportSize({ width: 1280, height: viewportHeight });
    await page.evaluate(() => window.studentApp.switchView('main-menu-view'));
    await page.waitForTimeout(120);

    const layout = await page.evaluate(() => {
        const rect = selector => {
            const bounds = document.querySelector(selector)?.getBoundingClientRect();
            return bounds ? {
                top: Math.round(bounds.top),
                bottom: Math.round(bounds.bottom),
                left: Math.round(bounds.left),
                width: Math.round(bounds.width),
                height: Math.round(bounds.height)
            } : null;
        };
        return {
            week: rect('#student-home-panel-week'),
            gate: rect('#student-home-dashboard > .student-arcade-gate-notice'),
            spark: rect('#student-home-panel-spark')
        };
    });

    assert.ok(layout.week, 'This Week panel is missing');
    assert.ok(layout.gate, 'Arcade unlock progress is missing');
    assert.ok(layout.week.height <= 250, `lower dashboard row is too tall: ${JSON.stringify(layout)}`);
    assert.ok(layout.gate.top > layout.week.top, `Arcade unlock progress is not inside This Week: ${JSON.stringify(layout)}`);
    assert.ok(layout.gate.bottom <= layout.week.bottom, `Arcade unlock progress overflows This Week: ${JSON.stringify(layout)}`);
    assert.ok(layout.gate.left > layout.week.left, `Arcade unlock progress does not have an inset: ${JSON.stringify(layout)}`);
    assert.ok(layout.gate.width < layout.week.width, `Arcade unlock progress is not contained by This Week: ${JSON.stringify(layout)}`);
    if (!layout.spark) {
        assert.ok(layout.week.width > 0, `This Week does not fill the support row: ${JSON.stringify(layout)}`);
    } else {
        assert.equal(layout.spark.top, layout.week.top, `Spark is not aligned with the support row: ${JSON.stringify(layout)}`);
        assert.equal(layout.spark.height, layout.week.height, `Spark has a different support-row height: ${JSON.stringify(layout)}`);
    }
}

async function assertShortDesktopTodayStartsAtTop(page) {
    await page.setViewportSize({ width: 1414, height: 866 });
    await page.evaluate(() => {
        window.studentApp.switchView('main-menu-view');
        const view = document.querySelector('#main-menu-view');
        if (view) view.scrollTop = 0;
    });
    await page.waitForTimeout(120);

    const layout = await page.evaluate(() => {
        const rect = selector => {
            const bounds = document.querySelector(selector)?.getBoundingClientRect();
            return bounds ? {
                top: Math.round(bounds.top),
                bottom: Math.round(bounds.bottom)
            } : null;
        };
        const view = document.querySelector('#main-menu-view');
        return {
            view: rect('#main-menu-view'),
            heading: rect('#main-menu-view > .student-dashboard-heading'),
            hero: rect('#student-home-dashboard .student-continue-hero'),
            week: rect('#student-home-panel-week'),
            gate: rect('#student-home-dashboard > .student-arcade-gate-notice'),
            spark: rect('#student-home-panel-spark'),
            sparkContent: rect('#student-home-panel-spark .student-spark-card > :last-child'),
            scrollTop: Math.round(view?.scrollTop || 0),
            scrollHeight: Math.round(view?.scrollHeight || 0),
            clientHeight: Math.round(view?.clientHeight || 0)
        };
    });

    assert.ok(layout.view && layout.heading && layout.hero, `short desktop Today layout is incomplete: ${JSON.stringify(layout)}`);
    assert.equal(layout.scrollTop, 0, `short desktop Today unexpectedly starts scrolled: ${JSON.stringify(layout)}`);
    assert.ok(layout.scrollHeight <= layout.clientHeight, `short desktop Today requires scrolling: ${JSON.stringify(layout)}`);
    assert.ok(layout.heading.top >= layout.view.top, `Today heading is clipped above the view: ${JSON.stringify(layout)}`);
    assert.ok(layout.hero.top >= layout.heading.bottom, `continue hero overlaps or precedes the Today heading: ${JSON.stringify(layout)}`);
    assert.ok(layout.week?.bottom <= layout.view.bottom, `This Week is below the fold: ${JSON.stringify(layout)}`);
    assert.ok(layout.gate?.bottom <= layout.view.bottom, `Arcade unlock progress is below the fold: ${JSON.stringify(layout)}`);
    if (layout.spark) {
        assert.ok(layout.spark.bottom <= layout.view.bottom, `Spark is below the fold: ${JSON.stringify(layout)}`);
        assert.ok(layout.sparkContent?.bottom <= layout.spark.bottom, `Spark content overflows its card: ${JSON.stringify(layout)}`);
    }
    const contentBottom = Math.max(layout.week?.bottom || 0, layout.spark?.bottom || 0);
    const topGap = layout.heading.top - layout.view.top;
    const bottomGap = layout.view.bottom - contentBottom;
    assert.ok(Math.abs(topGap - bottomGap) <= 3, `Today content is not vertically centered: ${JSON.stringify({ ...layout, topGap, bottomGap })}`);
    if (snapshotDir) {
        await page.screenshot({ path: path.join(snapshotDir, '1414-laptop-today.png'), animations: 'disabled' });
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
    await page.waitForTimeout(320);

    for (const width of widths) {
        await page.setViewportSize({ width, height: viewportHeight });
        for (const [view, viewId] of views) {
            await page.evaluate(id => window.studentApp.switchView(id), viewId);
            // The wide shell animates its rail for 280 ms. Read settled geometry,
            // otherwise faster browser builds can sample halfway through the transition.
            await page.waitForTimeout(340);
            const state = await readShellState(page, width, view);
            assertShellState(state);
            await assertStudentDesignSystem(page, width, view);
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

    await assertCompactTodaySupportRow(page);
    await assertShortDesktopTodayStartsAtTop(page);
    await assertCollapsedSidebar(page);
    await assertResizeTransition(page);
    if (browserProblems.length) {
        throw new Error(`Student shell audit emitted browser errors:\n${browserProblems.join('\n')}`);
    }
    if (snapshotDir) {
        fs.writeFileSync(path.join(snapshotDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }
    console.log(`Student shell regression tests passed for ${widths.length} widths, ${views.length} views, the collapsible rail, and the 1120px ↔ 1121px transition.`);
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
