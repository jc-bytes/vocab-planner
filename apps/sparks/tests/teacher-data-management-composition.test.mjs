import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() {
        return {
            style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
            appendChild() {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }
        };
    },
    body: { appendChild() {} },
    head: { appendChild() {} }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { createTeacherDataManagementFeature } = await import('../js/teacherDataManagement.js');

function createDependencies(overrides = {}) {
    return {
        ensureAuthenticated: () => true,
        activateDataManagement() {},
        writeDataRoute() {},
        isRouteApplying: () => false,
        isDataRouteCurrent: () => true,
        loadSubjectSettings: async () => {},
        loadGamificationSettings: async () => {},
        loadSchoolCalendarSettings: async () => {},
        saveGamificationSettings() {},
        saveSchoolCalendarSettings() {},
        bindSchoolCalendarInputs() {},
        addSubjectFromForm() {},
        saveSubjectSettings() {},
        loadRoster: async () => [],
        getRoster: () => [],
        getExplicitSelectedStudentIds: () => [],
        loadLibrary: async () => ({ cloudVocabs: [], remoteVocabs: [], localVocabs: [] }),
        loadDashboardAnalytics: async () => ({
            totalStudents: 0, activeStudents: 0, averageCoins: 0,
            availableGrades: [], activities: {}, gradeCounts: {}, coinDistribution: [], recentActivities: []
        }),
        getCurrentUser: () => ({ uid: 'teacher-one' }),
        feedback: { info() {}, success() {}, warning() {}, error() {} },
        storage: localStorage,
        refreshIcons() {},
        ...overrides
    };
}

test('Data Management exposes only its frozen page use cases', async () => {
    const activations = [];
    const routes = [];
    const settingsLoads = [];
    const feature = createTeacherDataManagementFeature(createDependencies({
        activateDataManagement: area => activations.push(area),
        writeDataRoute: (area, tab, options) => routes.push({ area, tab, options }),
        loadSubjectSettings: async () => settingsLoads.push('subjects'),
        loadGamificationSettings: async () => settingsLoads.push('gamification'),
        loadSchoolCalendarSettings: async () => settingsLoads.push('calendar')
    }));

    assert.equal(Object.isFrozen(feature), true);
    assert.deepEqual(Object.keys(feature), ['show', 'destroy']);
    assert.equal(await feature.show({ area: 'settings', tab: 'calendar', replaceRoute: true }), true);
    assert.deepEqual(activations, ['settings']);
    assert.deepEqual(routes, [{ area: 'settings', tab: 'calendar', options: { replace: true } }]);
    assert.deepEqual(settingsLoads.sort(), ['calendar', 'gamification', 'subjects']);
    feature.destroy();
    feature.destroy();
    assert.equal(await feature.show({ area: 'data', tab: 'view' }), false);
});

test('Data Management ignores late dashboard results after disposal', async () => {
    let resolveAnalytics;
    let rejectLibrary;
    const errors = [];
    const feature = createTeacherDataManagementFeature(createDependencies({
        loadDashboardAnalytics: () => new Promise(resolve => { resolveAnalytics = resolve; }),
        loadLibrary: () => new Promise((resolve, reject) => { rejectLibrary = reject; }),
        feedback: { info() {}, success() {}, warning() {}, error: message => errors.push(message) }
    }));

    const showing = feature.show({ area: 'data', tab: 'dashboard', updateRoute: false });
    feature.destroy();
    resolveAnalytics({ totalStudents: 1, activeStudents: 1, averageCoins: 10 });
    rejectLibrary(new Error('stale library failure'));
    assert.equal(await showing, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(errors, []);
});

test('Data Management does not activate after its reserved route is replaced', async () => {
    let activations = 0;
    const feature = createTeacherDataManagementFeature(createDependencies({
        activateDataManagement: () => { activations += 1; },
        isDataRouteCurrent: () => false
    }));

    assert.equal(await feature.show({ area: 'data', tab: 'dashboard', updateRoute: false }), false);
    assert.equal(activations, 0);
});

test('Data Management rejects a stale non-default tab for an area default route', async () => {
    let activations = 0;
    const feature = createTeacherDataManagementFeature(createDependencies({
        activateDataManagement: () => { activations += 1; },
        isDataRouteCurrent: (area, tab) => area === 'data' && tab === 'dashboard'
    }));

    assert.equal(await feature.show({ area: 'data', tab: 'export', updateRoute: false }), false);
    assert.equal(activations, 0);
});

test('Data Management ownership does not leak back onto TeacherManager', async () => {
    const [teacherSource, lazySource, shellSource, routingSource, calendarSource, dashboardSource] = await Promise.all([
        readFile(new URL('../js/teacher.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherLazyFeatures.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherShell.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherRouting.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherSchoolCalendarSettingsMethods.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherDataDashboardViewMethods.js', import.meta.url), 'utf8')
    ]);
    assert.doesNotMatch(teacherSource, /dataViewerInitialized|exportListenersInitialized/);
    assert.match(lazySource, /publicMethods:\s*\{ showDataManagementView: 'show' \}/);
    assert.match(lazySource, /createTeacherDataManagementFeature\(\{/);
    assert.doesNotMatch(shellSource, /this\.dataManagementArea|this\.activeDataTab/);
    assert.doesNotMatch(routingSource, /this\.dataManagementArea|this\.activeDataTab/);
    assert.match(shellSource, /setRoute\(\{ view: 'data', tab: options\.tab \|\| 'dashboard' \}\)[\s\S]*showDataManagementView/);
    assert.doesNotMatch(calendarSource, /calendarBound/);
    assert.match(calendarSource, /bindSchoolCalendarInputs\(listen[\s\S]*listen\(input, 'input'/);
    assert.match(dashboardSource, /await this\.renderDashboardCharts\(\);\s*if \(this\.destroyed[\s\S]*this\.renderRecentActivity\(\)/);
});
