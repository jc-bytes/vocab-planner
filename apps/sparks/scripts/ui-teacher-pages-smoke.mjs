import process from 'node:process';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_TEACHER_PAGES_HOST || '127.0.0.1';
const port = Number(process.env.UI_TEACHER_PAGES_PORT || 8563);
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
        const { installTeacherClassSelectionMethods } = await import('/js/teacherClassSelection.js');
        const { installTeacherRoutingMethods } = await import('/js/teacherRouting.js');
        const { teacherVocabularyWorkflowMethods } = await import('/js/teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js');
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
                <section id="quiz-maker-view" class="view hidden"></section><section id="teacher-spark-editor-view" class="view hidden"></section>
            </div>
        `;

        class Manager {
            constructor() {
                this.currentUser = { id: 'teacher-page-smoke' };
                this.authDisabled = true;
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
            showClassesView(context) { this.workspaceContext = context; if (context.tab === 'students') this.progressLoads += 1; this.switchView('teacher-classes-view', { updateRoute: false }); }
            showAssignmentsView(context) { this.workspaceContext = context; this.switchView(`teacher-${context.mode}-view`, { updateRoute: false }); }
            showSparkEditor(context) { this.workspaceContext = context; this.switchView('teacher-spark-editor-view', { updateRoute: false }); }
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
        Manager.prototype.resetLibraryDrilldown = teacherVocabularyWorkflowMethods.resetLibraryDrilldown;
        Manager.prototype.showProgressView = teacherProgressDataMethods.showProgressView;
        installTeacherRoutingMethods(Manager);
        installTeacherClassSelectionMethods(Manager);
        installTeacherShellMethods(Manager);
        const manager = new Manager();
        manager.selectTeacherClass('class-a');
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
        || initial.mobileLabel !== 'Home'
        || initial.topLabel !== 'Home'
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
    await page.waitForFunction(() => window.location.hash === '#/teacher/classes?class=class-a&tab=students');
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
        || vocabulary.mobileLabel !== 'Library'
        || vocabulary.topLabel !== 'Library'
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
    await page.waitForFunction(() => window.location.hash === '#/teacher/classes?class=class-a&tab=students');
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
        || sparks.activeSection !== 'vocabulary'
        || sparks.mobileLabel !== 'Library'
        || sparks.topLabel !== 'Library'
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
        || sparksDirect.activeSection !== 'vocabulary'
        || sparksDirect.loads !== 2) {
        throw new Error(`Sparks direct route changed: ${JSON.stringify(sparksDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('students'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/classes?class=class-a&tab=students');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/sparks'
        && document.querySelector('.view.active')?.id === 'teacher-sparks-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'vocabulary'
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
    if (students.hash !== '#/teacher/classes?class=class-a&tab=students'
        || students.activeView !== 'teacher-classes-view'
        || students.activeSection !== 'classes'
        || students.mobileLabel !== 'Classwork'
        || students.topLabel !== 'Classwork'
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
    if (studentsDirect.activeView !== 'teacher-classes-view'
        || studentsDirect.activeSection !== 'classes'
        || studentsDirect.loadDelta !== 1) {
        throw new Error(`Students direct route changed: ${JSON.stringify(studentsDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('overview'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/overview');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/classes?class=class-a&tab=students'
        && document.querySelector('.view.active')?.id === 'teacher-classes-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'classes'
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
    if (groups.hash !== '#/teacher/groups?class=class-a'
        || groups.activeView !== 'teacher-groups-view'
        || groups.activeSection !== 'classes'
        || groups.mobileLabel !== 'Classwork'
        || groups.topLabel !== 'Classwork'
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
        || groupsDirect.activeSection !== 'classes'
        || groupsDirect.loadDelta !== 1) {
        throw new Error(`Groups direct route changed: ${JSON.stringify(groupsDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('overview'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/overview');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/groups?class=class-a'
        && document.querySelector('.view.active')?.id === 'teacher-groups-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'classes'
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
    if (data.hash !== '#/teacher/overview'
        || data.activeView !== 'teacher-overview-view'
        || data.activeSection !== 'overview'
        || data.mobileLabel !== 'Home'
        || data.topLabel !== 'Home'
        || data.calls.length !== 0) {
        throw new Error(`Legacy Data navigation did not redirect Home: ${JSON.stringify(data)}`);
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
    if (dataDirect.activeView !== 'teacher-assignments-view'
        || dataDirect.activeSection !== 'assignments'
        || dataDirect.calls.length !== 0) {
        throw new Error(`Legacy Data export did not redirect Review: ${JSON.stringify(dataDirect)}`);
    }

    await page.evaluate(() => window.teacherPageSmokeManager.showTeacherSection('overview'));
    await page.waitForFunction(() => window.location.hash === '#/teacher/overview');
    await page.evaluate(() => history.back());
    await page.waitForFunction(() => (
        window.location.hash === '#/teacher/assignments?class=class-a&tab=needs-review'
        && document.querySelector('.view.active')?.id === 'teacher-assignments-view'
        && document.querySelector('.teacher-tab.active')?.dataset.section === 'assignments'
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

    const editorNavigation = await page.evaluate(async () => {
        const { installTeacherShellMethods } = await import('/js/teacherShell.js');
        const { installTeacherClassSelectionMethods } = await import('/js/teacherClassSelection.js');
        const { installTeacherRoutingMethods } = await import('/js/teacherRouting.js');
        const { installTeacherVocabularyStorageMethods } = await import('/js/teacherVocabularyStorage.js');
        const { installTeacherVocabularySessionMethods } = await import('/js/teacherVocabularySession.js');
        document.body.innerHTML = `
            <div id="teacher-tab-shell"></div>
            <div id="teacher-tabs"></div>
            <span id="teacher-mobile-section-label"></span>
            <span id="teacher-top-bar-section"></span>
            <section id="teacher-overview-view" class="view hidden"></section>
            <section id="teacher-dashboard-view" class="view hidden"></section>
            <section id="teacher-editor-view" class="view hidden"></section>
            <section id="teacher-loading-view" class="view hidden"></section>
            <section id="teacher-login-view" class="view hidden"></section>
        `;

        class Manager {
            constructor() {
                this.currentUser = { id: 'teacher-a' };
                this.authDisabled = true;
                this.isAuthenticated = true;
                this.isApplyingRoute = false;
                this.pendingTeacherRoute = null;
                this.pendingTeacherNavigation = null;
                this.teacherNavigationGeneration = 0;
                this.vocabSet = { id: 'before', name: 'Before' };
                this.libraryDrilldown = { subject: null, grade: null, trimester: null, month: null };
                this.vocabularyMode = 'assign';
                this.formUpdates = 0;
                this.wordRenders = 0;
                this.libraryFallbacks = 0;
            }
            ensureAuthenticated() { return true; }
            refreshIcons() {}
            loadTeacherOverview() {}
            updateFormUI() { this.formUpdates += 1; }
            renderWords() { this.wordRenders += 1; }
            showVocabularyLibrary() {
                this.libraryFallbacks += 1;
                this.switchView('teacher-dashboard-view');
            }
            setVocabularyWorkflowTab() {}
            loadLibrary() { return Promise.resolve(); }
        }
        installTeacherVocabularySessionMethods(Manager);
        installTeacherVocabularyStorageMethods(Manager);
        installTeacherRoutingMethods(Manager);
        installTeacherClassSelectionMethods(Manager);
        installTeacherShellMethods(Manager);

        let resolveLibrary;
        const manager = new Manager();
        manager.getTeacherLibrary = () => new Promise(resolve => { resolveLibrary = resolve; });
        history.replaceState(null, '', '#/teacher/vocabulary/editor/old-unit');
        const oldNavigation = manager.handleRouteChange();
        await Promise.resolve();
        manager.showTeacherSection('overview');
        const beforeResolve = {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            vocabId: manager.vocabSet.id,
            formUpdates: manager.formUpdates,
            wordRenders: manager.wordRenders,
            fallbacks: manager.libraryFallbacks
        };
        resolveLibrary({ items: [{ type: 'local', vocab: { id: 'old-unit', name: 'Stale unit', words: [] } }] });
        await oldNavigation;
        const afterResolve = {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            vocabId: manager.vocabSet.id,
            formUpdates: manager.formUpdates,
            wordRenders: manager.wordRenders,
            fallbacks: manager.libraryFallbacks,
            applying: manager.isApplyingRoute
        };

        const missingManager = new Manager();
        missingManager.getTeacherLibrary = () => Promise.resolve({ items: [] });
        history.replaceState(null, '', '#/teacher/vocabulary/editor/missing-unit');
        const historyBeforeMissing = history.length;
        await missingManager.handleRouteChange();
        const missingResult = {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            historyDelta: history.length - historyBeforeMissing,
            fallbacks: missingManager.libraryFallbacks
        };

        missingManager.vocabSet = { id: 'shared-unit', name: 'ACCOUNT A SECRET', words: [] };
        missingManager.clearTeacherVocabularySessionState();
        missingManager.currentUser = { id: 'teacher-b' };
        let accountBLoads = 0;
        missingManager.getTeacherLibrary = async () => {
            accountBLoads += 1;
            return {
                items: [{ type: 'local', vocab: { id: 'shared-unit', name: 'Account B unit', words: [] } }]
            };
        };
        history.replaceState(null, '', '#/teacher/vocabulary/editor/shared-unit');
        await missingManager.handleRouteChange();
        const accountSwitchResult = {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            vocabId: missingManager.vocabSet.id,
            vocabName: missingManager.vocabSet.name,
            loads: accountBLoads
        };
        return { beforeResolve, afterResolve, missingResult, accountSwitchResult };
    });
    if (JSON.stringify(editorNavigation.beforeResolve) !== JSON.stringify({
        hash: '#/teacher/overview',
        activeView: 'teacher-overview-view',
        vocabId: 'before',
        formUpdates: 0,
        wordRenders: 0,
        fallbacks: 0
    }) || JSON.stringify(editorNavigation.afterResolve) !== JSON.stringify({
        hash: '#/teacher/overview',
        activeView: 'teacher-overview-view',
        vocabId: 'before',
        formUpdates: 0,
        wordRenders: 0,
        fallbacks: 0,
        applying: false
    }) || JSON.stringify(editorNavigation.missingResult) !== JSON.stringify({
        hash: '#/teacher/vocabulary',
        activeView: 'teacher-dashboard-view',
        historyDelta: 0,
        fallbacks: 1
    }) || JSON.stringify(editorNavigation.accountSwitchResult) !== JSON.stringify({
        hash: '#/teacher/vocabulary/editor/shared-unit',
        activeView: 'teacher-editor-view',
        vocabId: 'shared-unit',
        vocabName: 'Account B unit',
        loads: 1
    })) {
        throw new Error(`Editor navigation lifecycle changed: ${JSON.stringify(editorNavigation)}`);
    }

    const workspaceRoutes = await page.evaluate(async () => {
        const manager = window.teacherPageSmokeManager;
        const routes = [
            { view: 'classes', classId: 'class/a', tab: 'work' },
            { view: 'assignments', classId: 'class-a' },
            { view: 'review', classId: 'class-a', assignmentId: 'assignment-a' },
            { view: 'spark-editor', materialId: 'spark-a' }
        ];
        const output = [];
        for (const route of routes) {
            const hash = manager.buildRoute(route);
            const parsed = manager.parseRoute(hash);
            await manager.applyRoute(parsed);
            output.push({ route, hash, parsed, context: manager.workspaceContext, view: document.querySelector('.view.active')?.id });
        }
        return output;
    });
    for (const result of workspaceRoutes) {
        for (const [key, value] of Object.entries(result.route)) {
            if (result.parsed[key] !== (key === 'view' && value === 'review' ? 'assignments' : value)) throw new Error(`Workspace route lost ${key}: ${JSON.stringify(result)}`);
        }
        if (result.route.classId && result.context.classId !== result.route.classId) throw new Error('Class context was not passed to workspace.');
        if (result.route.assignmentId && result.context.assignmentId !== result.route.assignmentId) throw new Error('Assignment context was not passed to review.');
    }
    console.log('Teacher navigation smoke passed: primary tools, context routes, editor lifecycle, direct routing and history.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
