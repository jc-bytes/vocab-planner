import process from 'node:process';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_TEACHER_DATA_HOST || '127.0.0.1';
const port = Number(process.env.UI_TEACHER_DATA_PORT || 8000);
const baseUrl = (process.env.UI_TEACHER_DATA_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');
let server;
let browser;
const problems = [];

try {
    server = await ensureViteServer({ baseUrl, probePath: '/', host, port, external: Boolean(process.env.UI_TEACHER_DATA_BASE_URL) });
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', message => {
        if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const result = await page.evaluate(async () => {
        const source = await fetch('/teacher.html').then(response => response.text());
        const parsed = new DOMParser().parseFromString(source, 'text/html');
        const template = parsed.querySelector('#teacher-data-management-view-template');
        document.body.innerHTML = `<div data-teacher-feature-mount="data-management-view"></div>${template.outerHTML}`;

        const { supabaseService } = await import('/js/supabaseService.js');
        const { teacherExportRepository } = await import('/js/services/teacherExportRepository.js');
        let analyticsRequests = 0;
        supabaseService.getTeacherDashboardAnalytics = async () => {
            analyticsRequests += 1;
            return {
                totalStudents: 2, activeStudents: 1, averageCoins: 25,
                availableGrades: ['6'], activities: {}, gradeCounts: { 6: 2 },
                coinDistribution: [1, 1, 0, 0, 0], recentActivities: []
            };
        };
        const charts = [];
        window.Chart = class {
            constructor() { this.destroyed = false; charts.push(this); }
            destroy() { this.destroyed = true; }
        };
        let resolveExport;
        let exportRequests = 0;
        let exportLogs = 0;
        let downloads = 0;
        teacherExportRepository.getStudentProgressBatch = () => {
            exportRequests += 1;
            return new Promise(resolve => { resolveExport = resolve; });
        };
        teacherExportRepository.listScoresForUsers = async () => [];
        teacherExportRepository.getProfiles = async () => [];
        teacherExportRepository.logExport = async () => { exportLogs += 1; };
        const originalAnchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function click() { downloads += 1; };
        const { installTeacherLazyFeatureMethods } = await import(
            `/js/teacherLazyFeatures.js?data-management-smoke=${Date.now()}`
        );
        let coinSaves = 0;
        let rosterRequests = 0;
        class Manager {
            constructor() {
                this.isApplyingRoute = false;
                this.currentUser = { uid: 'teacher-smoke' };
                this.allStudentData = [{ id: 'student-one', studentProfile: { grade: '6' } }];
                // The default export option is "all" and must not be shadowed by
                // the explicit-selection capability.
                this.selectedStudents = new Set();
                this.routes = [];
            }
            ensureAuthenticated() { return true; }
            switchView(viewId, options) { this.currentView = viewId; this.viewOptions = options; }
            setActiveTeacherTab(area) { this.activeSection = area; }
            setRoute(route, options) { this.routes.push({ route, options }); }
            parseRoute() { return this.routes.at(-1)?.route || null; }
            loadSubjectSettings() { return Promise.resolve(); }
            loadGamificationSettings() { return Promise.resolve(); }
            loadSchoolCalendarSettings() { return Promise.resolve(); }
            saveGamificationSettings() { coinSaves += 1; }
            saveSchoolCalendarSettings() {}
            bindSchoolCalendarInputs() {}
            addSubjectFromForm() {}
            saveSubjectSettings() {}
            async getStudentRosterData() { rosterRequests += 1; return this.allStudentData; }
            async getTeacherLibrary() { return { cloudVocabs: [{}], remoteVocabs: [], localVocabs: [] }; }
            refreshIcons() {}
        }
        installTeacherLazyFeatureMethods(Manager);
        const manager = new Manager();
        const mountedBefore = Boolean(document.querySelector('#teacher-data-management-view'));
        await manager.showDataManagementView({ area: 'data', tab: 'dashboard', replaceRoute: true });
        await new Promise(resolve => setTimeout(resolve, 0));
        const first = {
            mountedBefore,
            mountedAfter: Boolean(document.querySelector('#teacher-data-management-view')),
            currentView: manager.currentView,
            activeSection: manager.activeSection,
            title: document.querySelector('#data-management-title')?.textContent,
            dashboardVisible: getComputedStyle(document.querySelector('#data-dashboard-section')).display !== 'none',
            totalStudents: document.querySelector('#dashboard-total-students')?.textContent,
            analyticsRequests,
            route: manager.routes.at(-1),
            leakedMethod: typeof manager.switchDataTab,
            leakedState: Object.keys(manager).filter(key => /^(dataManagement|activeDataTab|dashboardAnalytics|loadedData)/.test(key))
        };

        document.querySelector('#data-tab-export').click();
        await new Promise(resolve => setTimeout(resolve, 0));
        document.querySelector('#export-scores').checked = false;
        document.querySelector('#export-json-btn').click();
        await new Promise(resolve => setTimeout(resolve, 0));
        manager.disposeLoadedTeacherFeatures();
        resolveExport([]);
        await new Promise(resolve => setTimeout(resolve, 0));
        const chartsDestroyed = charts.length > 0 && charts.every(chart => chart.destroyed);
        manager.currentView = 'newer-view';
        manager.routes.push({ route: { view: 'data' } });
        const staleSameAreaResult = await manager.showDataManagementView({
            area: 'data', tab: 'export', updateRoute: false
        });
        const staleSameAreaView = manager.currentView;
        await manager.showDataManagementView({ area: 'settings', tab: 'gamification' });
        document.querySelector('#save-gamification-btn').click();
        const recreatedTitle = document.querySelector('#data-management-title')?.textContent;
        const resetStatusPreserved = Boolean(
            document.querySelector('#reset-export-status .data-reset-export-status__text')
            && document.querySelector('#reset-export-status [data-lucide]')
        );
        await manager.showDataManagementView({ area: 'data', tab: 'view' });
        const fileInput = document.querySelector('#load-json-file');
        let resolveFirstFile;
        const firstFile = {
            name: 'first.json', size: 100, type: 'application/json',
            text: () => new Promise(resolve => { resolveFirstFile = resolve; })
        };
        const secondFile = {
            name: 'second.json', size: 100, type: 'application/json',
            text: async () => JSON.stringify({
                studentProgress: [{ studentId: 'second', studentProfile: { firstName: 'Second', lastName: 'Teacher' } }]
            })
        };
        Object.defineProperty(fileInput, 'files', { configurable: true, value: [firstFile] });
        fileInput.dispatchEvent(new Event('change'));
        Object.defineProperty(fileInput, 'files', { configurable: true, value: [secondFile] });
        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 0));
        resolveFirstFile(JSON.stringify({
            studentProgress: [{ studentId: 'first', studentProfile: { firstName: 'First', lastName: 'Teacher' } }]
        }));
        await new Promise(resolve => setTimeout(resolve, 0));
        const viewerText = document.querySelector('#viewer-tables-content')?.textContent || '';
        window.viewerImportExecuted = 0;
        const unsafeFile = {
            name: 'unsafe.json', size: 100, type: 'application/json',
            text: async () => JSON.stringify({
                studentProgress: [{
                    studentId: 'unsafe',
                    studentProfile: { firstName: 'Safe', lastName: 'Display' },
                    coinData: { balance: '<img src=x onerror="window.viewerImportExecuted=1">' }
                }],
                scores: [{
                    userId: 'unsafe', gameId: 'snake',
                    score: '<img src=x onerror="window.viewerImportExecuted=1">'
                }]
            })
        };
        Object.defineProperty(fileInput, 'files', { configurable: true, value: [unsafeFile] });
        fileInput.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 20));
        const unsafeViewerHtml = document.querySelector('#viewer-tables-content')?.innerHTML || '';
        document.querySelector('#clear-file-btn').click();
        const viewerCleared = !document.querySelector('#viewer-summary-stats')?.textContent
            && !document.querySelector('#viewer-tables-content')?.textContent;

        teacherExportRepository.getStudentProgressBatch = async () => {
            exportRequests += 1;
            return [];
        };
        await manager.showDataManagementView({ area: 'data', tab: 'export' });
        document.querySelector('#export-json-btn').click();
        for (let attempt = 0; attempt < 100; attempt += 1) {
            if (document.querySelector('#reset-export-status .data-reset-export-status__text')?.textContent
                === 'Export completed. Reset is now enabled.') break;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        const completedResetStatus = document.querySelector('#reset-export-status .data-reset-export-status__text');
        const completedResetText = completedResetStatus?.textContent;
        const completedResetSuccessClass = completedResetStatus?.classList.contains('data-export-reset-enabled');
        manager.disposeLoadedTeacherFeatures();
        const resetWarning = {
            text: document.querySelector('#reset-export-status .data-reset-export-status__text')?.textContent,
            icon: document.querySelector('#reset-export-status [data-lucide]')?.getAttribute('data-lucide'),
            disabled: document.querySelector('#reset-data-btn')?.disabled,
            opacity: document.querySelector('#data-reset-section')?.style.opacity
        };
        HTMLAnchorElement.prototype.click = originalAnchorClick;
        return {
            ...first,
            rosterRequests,
            chartsDestroyed,
            staleSameAreaResult,
            staleSameAreaView,
            exportRequests,
            exportLogs,
            downloads,
            coinSaves,
            viewerText,
            unsafeViewerHtml,
            viewerImportExecuted: window.viewerImportExecuted,
            viewerCleared,
            completedResetText,
            completedResetSuccessClass,
            resetWarning,
            recreatedTitle,
            resetStatusPreserved,
            leakedStateAfterReload: Object.keys(manager).filter(key => /^(dataManagement|activeDataTab|dashboardAnalytics|loadedData)/.test(key))
        };
    });

    if (result.mountedBefore || !result.mountedAfter || result.currentView !== 'teacher-data-management-view') {
        throw new Error(`Data Management lazy mounting changed: ${JSON.stringify(result)}`);
    }
    if (result.activeSection !== 'data' || result.title !== 'Data' || !result.dashboardVisible || result.totalStudents !== '2') {
        throw new Error(`Data dashboard activation changed: ${JSON.stringify(result)}`);
    }
    if (result.analyticsRequests !== 1 || result.rosterRequests !== 2 || result.route?.route?.tab !== 'dashboard') {
        throw new Error(`Data loading or routing changed: ${JSON.stringify(result)}`);
    }
    if (!result.chartsDestroyed || result.coinSaves !== 1 || result.recreatedTitle !== 'Settings' || !result.resetStatusPreserved) {
        throw new Error(`Data disposal/recreation changed: ${JSON.stringify(result)}`);
    }
    if (result.staleSameAreaResult !== false || result.staleSameAreaView !== 'newer-view') {
        throw new Error(`A stale same-area Data tab replaced the canonical default: ${JSON.stringify(result)}`);
    }
    if (result.exportRequests !== 2 || result.exportLogs !== 1 || result.downloads !== 1) {
        throw new Error(`Disposed export produced a side effect: ${JSON.stringify(result)}`);
    }
    if (result.completedResetText !== 'Export completed. Reset is now enabled.'
        || !result.completedResetSuccessClass
        || result.resetWarning.text !== 'Export required before reset'
        || result.resetWarning.icon !== 'triangle-alert'
        || !result.resetWarning.disabled
        || result.resetWarning.opacity !== '0.5') {
        throw new Error(`Data reset status crossed feature disposal: ${JSON.stringify(result)}`);
    }
    if (!result.viewerText.includes('Second Teacher') || result.viewerText.includes('First Teacher')) {
        throw new Error(`Stale Viewer file replaced the latest file: ${JSON.stringify(result)}`);
    }
    if (result.viewerImportExecuted !== 0 || /<img/i.test(result.unsafeViewerHtml) || !result.viewerCleared) {
        throw new Error(`Viewer import escaping or clearing changed: ${JSON.stringify(result)}`);
    }
    if (result.leakedMethod !== 'undefined' || result.leakedState.length || result.leakedStateAfterReload.length) {
        throw new Error(`Data internals leaked onto TeacherManager: ${JSON.stringify(result)}`);
    }
    if (problems.length) throw new Error(problems.join('\n'));
    console.log('Teacher Data Management lazy-feature smoke passed.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
