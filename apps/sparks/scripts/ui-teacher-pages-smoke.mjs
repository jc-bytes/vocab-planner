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
        const { installTeacherShellMethods } = await import('/js/teacherShell.js');
        const { installTeacherRoutingMethods } = await import('/js/teacherRouting.js');
        const { teacherVocabularyWorkflowMethods } = await import('/js/teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js');
        const { teacherVocabularyDataMethods } = await import('/js/teacherVocabularyLibrary/teacherVocabularyDataMethods.js');
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
            }
            ensureAuthenticated() { return true; }
            refreshIcons() {}
            loadTeacherOverview() { this.overviewLoads += 1; }
            showSparksView() { this.switchView('teacher-sparks-view'); }
            showProgressView() { this.switchView('teacher-progress-view'); }
            showGroupsView() { this.switchView('teacher-groups-view'); }
            showDataManagementView({ area }) { this.switchView('teacher-data-management-view', { updateRoute: false }); this.setActiveTeacherTab(area); }
            setVocabularyWorkflowTab(mode, options) { this.workflowCalls.push({ mode, options }); }
            loadLibrary() { this.libraryLoads += 1; return Promise.resolve(); }
            getTeacherLibrary() { return Promise.resolve({ items: [] }); }
        }
        Manager.prototype.showVocabularyLibrary = teacherVocabularyWorkflowMethods.showVocabularyLibrary;
        Manager.prototype.resetLibraryDrilldown = teacherVocabularyDataMethods.resetLibraryDrilldown;
        installTeacherRoutingMethods(Manager);
        installTeacherShellMethods(Manager);
        const manager = new Manager();
        window.teacherPageSmokeManager = manager;
        window.addEventListener('hashchange', () => manager.handleRouteChange());
        window.addEventListener('popstate', () => manager.handleRouteChange());

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
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/overview'
        && document.querySelector('.view.active')?.id === 'teacher-overview-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'overview'
    ));

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

    console.log('Teacher primary-page smoke passed for Overview and Vocabulary navigation, direct routing, and history.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
