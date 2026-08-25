import process from 'node:process';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_TEACHER_PAGES_HOST || '127.0.0.1';
const port = Number(process.env.UI_TEACHER_PAGES_PORT || 8000);
const baseUrl = (process.env.UI_TEACHER_PAGES_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');
let server;
let browser;

try {
    server = await ensureViteServer({
        baseUrl,
        probePath: '/',
        host,
        port,
        external: Boolean(process.env.UI_TEACHER_PAGES_BASE_URL)
    });
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const initial = await page.evaluate(async () => {
        const { teacherPageRegistry } = await import('/js/teacherPageRegistry.js');
        const sparksPage = teacherPageRegistry.get('sparks');
        const groupsPage = teacherPageRegistry.get('groups');
        const dataPage = teacherPageRegistry.get('data');
        const settingsPage = teacherPageRegistry.get('settings');
        const { installTeacherShellMethods } = await import('/js/teacherShell.js');
        const { installTeacherRoutingMethods } = await import('/js/teacherRouting.js');
        const { teacherVocabularyWorkflowMethods } = await import('/js/teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js');
        const { teacherVocabularyDataMethods } = await import('/js/teacherVocabularyLibrary/teacherVocabularyDataMethods.js');
        const { teacherProgressDataMethods } = await import('/js/teacherStudentProgress/teacherProgressDataMethods.js');
        const teacherSource = await fetch('/teacher.html').then(response => response.text());
        const parsedTeacher = new DOMParser().parseFromString(teacherSource, 'text/html');
        const navigation = parsedTeacher.querySelector('#teacher-tab-shell').outerHTML;
        const topBarLabel = parsedTeacher.querySelector('#teacher-top-bar-section').outerHTML;
        document.body.innerHTML = `
            <div class="app-container">
                ${navigation}
                ${topBarLabel}
                ${Array.from(new Set(teacherPageRegistry.pages.map(page => page.viewId)))
                    .map(viewId => `<section id="${viewId}" class="view hidden"></section>`).join('')}
                <section id="teacher-loading-view" class="view hidden"></section>
                <section id="teacher-login-view" class="view hidden"></section>
                <section id="teacher-editor-view" class="view hidden"></section>
                <section id="quiz-maker-view" class="view hidden"></section>
            </div>
        `;

        class Manager {
            constructor() {
                this.isAuthenticated = true;
                this.isApplyingRoute = false;
                this.pendingTeacherRoute = null;
                this.vocabularyMode = 'assign';
                this.libraryDrilldown = { subject: null, grade: null, trimester: null, month: null };
                this.overviewLoads = 0;
                this.libraryLoads = 0;
                this.workflowCalls = [];
                this.sparkLoads = 0;
                this.progressLoads = 0;
                this.groupLoads = 0;
                this.dataCalls = [];
            }
            ensureAuthenticated() { return true; }
            refreshIcons() {}
            loadTeacherOverview() { this.overviewLoads += 1; }
            showSparksView() { this.sparkLoads += 1; this.switchView(sparksPage.viewId); }
            showGroupsView() { this.groupLoads += 1; this.switchView(groupsPage.viewId); }
            showDataManagementView({ area, tab }) {
                this.dataCalls.push({ area, tab });
                this.switchView(area === settingsPage.id ? settingsPage.viewId : dataPage.viewId, { updateRoute: false });
                this.setActiveTeacherTab(area);
            }
            setVocabularyWorkflowTab(mode, options) { this.workflowCalls.push({ mode, options }); }
            loadLibrary() { this.libraryLoads += 1; return Promise.resolve(); }
            getTeacherLibrary() { return Promise.resolve({ items: [] }); }
            loadStudentRosterFilters() { return Promise.resolve(); }
            populateFilters() {}
            fetchStudentProgressPage() { this.progressLoads += 1; return Promise.resolve(); }
        }
        Manager.prototype.showVocabularyLibrary = teacherVocabularyWorkflowMethods.showVocabularyLibrary;
        Manager.prototype.resetLibraryDrilldown = teacherVocabularyDataMethods.resetLibraryDrilldown;
        Manager.prototype.showProgressView = teacherProgressDataMethods.showProgressView;
        installTeacherRoutingMethods(Manager);
        installTeacherShellMethods(Manager);
        const manager = new Manager();
        window.teacherPageSmokeManager = manager;
        window.addEventListener('hashchange', () => manager.handleRouteChange());

        manager.showTeacherSection('overview');
        manager.showDashboard();
        return {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            mobileLabel: document.querySelector('#teacher-mobile-section-label')?.textContent,
            topLabel: document.querySelector('#teacher-top-bar-section')?.textContent,
            loads: manager.overviewLoads
        };
    });

    if (initial.hash !== '#/teacher/overview'
        || initial.activeView !== 'teacher-overview-view'
        || initial.activeSection !== 'overview'
        || initial.mobileLabel !== 'Overview'
        || initial.topLabel !== 'Overview'
        || initial.loads !== 2) {
        throw new Error(`Overview navigation changed: ${JSON.stringify(initial)}`);
    }

    const direct = await page.evaluate(async () => {
        history.replaceState(null, '', '#/teacher/overview');
        await window.teacherPageSmokeManager.handleRouteChange();
        return {
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            loads: window.teacherPageSmokeManager.overviewLoads
        };
    });
    if (direct.activeView !== 'teacher-overview-view' || direct.activeSection !== 'overview' || direct.loads !== 3) {
        throw new Error(`Overview direct route changed: ${JSON.stringify(direct)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('students'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/students');
    const overviewLoadsBeforeBack = await page.evaluate(() => window.teacherPageSmokeManager.overviewLoads);
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/overview'
        && document.querySelector('.view.active')?.id === 'teacher-overview-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'overview'
    ));
    await page.waitForTimeout(25);
    const overviewLoadsAfterBack = await page.evaluate(() => window.teacherPageSmokeManager.overviewLoads);
    if (overviewLoadsAfterBack - overviewLoadsBeforeBack !== 1) {
        throw new Error(`One Back action applied Overview ${overviewLoadsAfterBack - overviewLoadsBeforeBack} times.`);
    }

    const vocabulary = await page.evaluate(() => {
        const manager = window.teacherPageSmokeManager;
        manager.showTeacherSection('vocabulary');
        return {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            mobileLabel: document.querySelector('#teacher-mobile-section-label')?.textContent,
            topLabel: document.querySelector('#teacher-top-bar-section')?.textContent,
            mode: manager.vocabularyMode,
            drilldown: manager.libraryDrilldown,
            libraryLoads: manager.libraryLoads
        };
    });
    if (vocabulary.hash !== '#/teacher/vocabulary'
        || vocabulary.activeView !== 'teacher-dashboard-view'
        || vocabulary.activeSection !== 'vocabulary'
        || vocabulary.mobileLabel !== 'Vocabulary'
        || vocabulary.topLabel !== 'Vocabulary'
        || vocabulary.mode !== 'assign'
        || Object.values(vocabulary.drilldown).some(Boolean)
        || vocabulary.libraryLoads !== 1) {
        throw new Error(`Vocabulary navigation changed: ${JSON.stringify(vocabulary)}`);
    }

    const vocabularyDirect = await page.evaluate(async () => {
        history.replaceState(null, '', '#/teacher/vocabulary?subject=technology&grade=7&trimester=2&month=May&mode=review');
        await window.teacherPageSmokeManager.handleRouteChange();
        const manager = window.teacherPageSmokeManager;
        return {
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            mode: manager.vocabularyMode,
            drilldown: manager.libraryDrilldown,
            workflow: manager.workflowCalls.at(-1)
        };
    });
    if (vocabularyDirect.activeView !== 'teacher-dashboard-view'
        || vocabularyDirect.activeSection !== 'vocabulary'
        || vocabularyDirect.mode !== 'review'
        || vocabularyDirect.drilldown.subject !== 'technology'
        || vocabularyDirect.drilldown.grade !== '7'
        || vocabularyDirect.drilldown.trimester !== '2'
        || vocabularyDirect.drilldown.month !== 'May'
        || vocabularyDirect.workflow?.mode !== 'review'
        || vocabularyDirect.workflow?.options?.loadReview !== true) {
        throw new Error(`Vocabulary direct route changed: ${JSON.stringify(vocabularyDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('students'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/students');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/vocabulary?subject=technology&grade=7&trimester=2&month=May&mode=review'
        && document.querySelector('.view.active')?.id === 'teacher-dashboard-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'vocabulary'
    ));

    const sparks = await page.evaluate(() => {
        const manager = window.teacherPageSmokeManager;
        manager.showTeacherSection('sparks');
        return {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            mobileLabel: document.querySelector('#teacher-mobile-section-label')?.textContent,
            topLabel: document.querySelector('#teacher-top-bar-section')?.textContent,
            loads: manager.sparkLoads
        };
    });
    if (sparks.hash !== '#/teacher/sparks'
        || sparks.activeView !== 'teacher-sparks-view'
        || sparks.activeSection !== 'sparks'
        || sparks.mobileLabel !== 'Sparks'
        || sparks.topLabel !== 'Sparks'
        || sparks.loads !== 1) {
        throw new Error(`Sparks navigation changed: ${JSON.stringify(sparks)}`);
    }

    const sparksDirect = await page.evaluate(async () => {
        history.replaceState(null, '', '#/teacher/sparks');
        await window.teacherPageSmokeManager.handleRouteChange();
        const manager = window.teacherPageSmokeManager;
        return {
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            loads: manager.sparkLoads
        };
    });
    if (sparksDirect.activeView !== 'teacher-sparks-view'
        || sparksDirect.activeSection !== 'sparks'
        || sparksDirect.loads !== 2) {
        throw new Error(`Sparks direct route changed: ${JSON.stringify(sparksDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('students'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/students');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/sparks'
        && document.querySelector('.view.active')?.id === 'teacher-sparks-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'sparks'
    ));

    const students = await page.evaluate(async () => {
        const manager = window.teacherPageSmokeManager;
        const loadsBefore = manager.progressLoads;
        manager.showTeacherSection('students');
        await new Promise(resolve => setTimeout(resolve, 0));
        return {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            mobileLabel: document.querySelector('#teacher-mobile-section-label')?.textContent,
            topLabel: document.querySelector('#teacher-top-bar-section')?.textContent,
            loadDelta: manager.progressLoads - loadsBefore
        };
    });
    if (students.hash !== '#/teacher/students'
        || students.activeView !== 'teacher-progress-view'
        || students.activeSection !== 'students'
        || students.mobileLabel !== 'Students'
        || students.topLabel !== 'Students'
        || students.loadDelta !== 1) {
        throw new Error(`Students navigation changed: ${JSON.stringify(students)}`);
    }

    const studentsDirect = await page.evaluate(async () => {
        const manager = window.teacherPageSmokeManager;
        const loadsBefore = manager.progressLoads;
        history.replaceState(null, '', '#/teacher/students');
        await manager.handleRouteChange();
        return {
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            loadDelta: manager.progressLoads - loadsBefore
        };
    });
    if (studentsDirect.activeView !== 'teacher-progress-view'
        || studentsDirect.activeSection !== 'students'
        || studentsDirect.loadDelta !== 1) {
        throw new Error(`Students direct route changed: ${JSON.stringify(studentsDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('overview'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/overview');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/students'
        && document.querySelector('.view.active')?.id === 'teacher-progress-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'students'
    ));

    const groups = await page.evaluate(() => {
        const manager = window.teacherPageSmokeManager;
        const loadsBefore = manager.groupLoads;
        manager.showTeacherSection('groups');
        return {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            mobileLabel: document.querySelector('#teacher-mobile-section-label')?.textContent,
            topLabel: document.querySelector('#teacher-top-bar-section')?.textContent,
            loadDelta: manager.groupLoads - loadsBefore
        };
    });
    if (groups.hash !== '#/teacher/groups'
        || groups.activeView !== 'teacher-groups-view'
        || groups.activeSection !== 'groups'
        || groups.mobileLabel !== 'Groups'
        || groups.topLabel !== 'Groups'
        || groups.loadDelta !== 1) {
        throw new Error(`Groups navigation changed: ${JSON.stringify(groups)}`);
    }

    const groupsDirect = await page.evaluate(async () => {
        const manager = window.teacherPageSmokeManager;
        const loadsBefore = manager.groupLoads;
        history.replaceState(null, '', '#/teacher/groups');
        await manager.handleRouteChange();
        return {
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            loadDelta: manager.groupLoads - loadsBefore
        };
    });
    if (groupsDirect.activeView !== 'teacher-groups-view'
        || groupsDirect.activeSection !== 'groups'
        || groupsDirect.loadDelta !== 1) {
        throw new Error(`Groups direct route changed: ${JSON.stringify(groupsDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('overview'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/overview');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/groups'
        && document.querySelector('.view.active')?.id === 'teacher-groups-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'groups'
    ));

    const data = await page.evaluate(() => {
        const manager = window.teacherPageSmokeManager;
        const callsBefore = manager.dataCalls.length;
        manager.showTeacherSection('data');
        return {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            mobileLabel: document.querySelector('#teacher-mobile-section-label')?.textContent,
            topLabel: document.querySelector('#teacher-top-bar-section')?.textContent,
            calls: manager.dataCalls.slice(callsBefore)
        };
    });
    if (data.hash !== '#/teacher/data?tab=dashboard'
        || data.activeView !== 'teacher-data-management-view'
        || data.activeSection !== 'data'
        || data.mobileLabel !== 'Data'
        || data.topLabel !== 'Data'
        || data.calls.length !== 1
        || data.calls[0].area !== 'data'
        || data.calls[0].tab !== undefined) {
        throw new Error(`Data navigation changed: ${JSON.stringify(data)}`);
    }

    const dataDirect = await page.evaluate(async () => {
        const manager = window.teacherPageSmokeManager;
        const callsBefore = manager.dataCalls.length;
        history.replaceState(null, '', '#/teacher/data?tab=export');
        await manager.handleRouteChange();
        return {
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            calls: manager.dataCalls.slice(callsBefore)
        };
    });
    if (dataDirect.activeView !== 'teacher-data-management-view'
        || dataDirect.activeSection !== 'data'
        || dataDirect.calls.length !== 1
        || dataDirect.calls[0].area !== 'data'
        || dataDirect.calls[0].tab !== 'export') {
        throw new Error(`Data direct route changed: ${JSON.stringify(dataDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('overview'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/overview');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/data?tab=export'
        && document.querySelector('.view.active')?.id === 'teacher-data-management-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'data'
    ));

    const settings = await page.evaluate(() => {
        const manager = window.teacherPageSmokeManager;
        const callsBefore = manager.dataCalls.length;
        manager.showTeacherSection('settings');
        return {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            mobileLabel: document.querySelector('#teacher-mobile-section-label')?.textContent,
            topLabel: document.querySelector('#teacher-top-bar-section')?.textContent,
            calls: manager.dataCalls.slice(callsBefore)
        };
    });
    if (settings.hash !== '#/teacher/settings?tab=subjects'
        || settings.activeView !== 'teacher-data-management-view'
        || settings.activeSection !== 'settings'
        || settings.mobileLabel !== 'Settings'
        || settings.topLabel !== 'Settings'
        || settings.calls.length !== 1
        || settings.calls[0].area !== 'settings'
        || settings.calls[0].tab !== undefined) {
        throw new Error(`Settings navigation changed: ${JSON.stringify(settings)}`);
    }

    const settingsDirect = await page.evaluate(async () => {
        const manager = window.teacherPageSmokeManager;
        const callsBefore = manager.dataCalls.length;
        history.replaceState(null, '', '#/teacher/settings?tab=gamification');
        await manager.handleRouteChange();
        return {
            activeView: document.querySelector('.view.active')?.id,
            activeSection: document.querySelector('.teacher-tab.active')?.dataset.section,
            calls: manager.dataCalls.slice(callsBefore)
        };
    });
    if (settingsDirect.activeView !== 'teacher-data-management-view'
        || settingsDirect.activeSection !== 'settings'
        || settingsDirect.calls.length !== 1
        || settingsDirect.calls[0].area !== 'settings'
        || settingsDirect.calls[0].tab !== 'gamification') {
        throw new Error(`Settings direct route changed: ${JSON.stringify(settingsDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('overview'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/overview');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/settings?tab=gamification'
        && document.querySelector('.view.active')?.id === 'teacher-data-management-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'settings'
    ));

    console.log('Teacher primary-page smoke passed for all seven registered pages: navigation, direct routing, and history.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
