import process from 'node:process';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_TEACHER_GROUPS_HOST || '127.0.0.1';
const port = Number(process.env.UI_TEACHER_GROUPS_PORT || 8000);
const baseUrl = (process.env.UI_TEACHER_GROUPS_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');

let server;
let browser;
const problems = [];

try {
    server = await ensureViteServer({
        baseUrl,
        probePath: '/',
        host,
        port,
        external: Boolean(process.env.UI_TEACHER_GROUPS_BASE_URL)
    });
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', message => {
        if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const setup = await page.evaluate(async () => {
        document.body.innerHTML = `
            <select id="group-class-select"></select>
            <div id="group-roster-summary"></div>
            <div id="group-student-list"></div>
            <button id="clear-group-absences-btn" type="button">Clear</button>
            <select id="group-size-select"><option value="2">2</option></select>
            <button id="randomize-groups-btn" type="button">Randomize</button>
            <button id="copy-groups-btn" class="hidden" type="button">Copy</button>
            <div id="group-results"></div>
            <select id="group-restriction-student-a"></select>
            <select id="group-restriction-student-b"></select>
            <button id="save-group-restriction-btn" type="button">Save</button>
            <div id="group-restriction-list"></div>
            <span id="group-restriction-count"></span>
            <div id="group-restriction-status"></div>
            <div id="group-generator-status"></div>
        `;

        const roster = [
            ['one', 'Ana', 'Alba'],
            ['two', 'Ben', 'Bello'],
            ['three', 'Cora', 'Cruz'],
            ['four', 'Dani', 'Diaz']
        ].map(([id, firstName, lastName]) => ({
            id,
            studentProfile: { firstName, lastName, grade: '6', group: 'A' }
        }));
        const stored = new Map();
        const calls = { show: 0, load: 0, create: 0, remove: 0, copied: '' };
        const repository = {
            async list() { return []; },
            async create(studentAId, studentBId) {
                calls.create += 1;
                return { id: 'saved-pair', studentAId, studentBId };
            },
            async remove() { calls.remove += 1; }
        };
        const module = await import(`/js/teacherGroups.js?groups-smoke=${Date.now()}`);
        const feature = module.createTeacherGroupsFeature({
            ensureAuthenticated: () => true,
            showView: () => { calls.show += 1; },
            loadRoster: async () => { calls.load += 1; return roster; },
            getSession: () => ({ authDisabled: false, currentUser: { id: 'teacher-one' } }),
            refreshIcons: () => {},
            repository,
            feedback: { success: () => {}, error: () => {} },
            storage: {
                getItem: key => stored.get(key) || null,
                setItem: (key, value) => stored.set(key, value)
            },
            clipboard: { writeText: async text => { calls.copied = text; } }
        });
        window.groupsSmoke = { feature, calls, stored };
        await feature.show();
        await feature.show();
        return {
            publicKeys: Object.keys(feature).sort(),
            showCalls: calls.show,
            loadCalls: calls.load
        };
    });

    if (JSON.stringify(setup.publicKeys) !== JSON.stringify(['destroy', 'show'])) {
        throw new Error(`Groups feature leaked internal methods: ${JSON.stringify(setup.publicKeys)}`);
    }
    if (setup.showCalls !== 2 || setup.loadCalls !== 2) {
        throw new Error(`Repeat show contract failed: ${JSON.stringify(setup)}`);
    }

    const absence = page.locator('#group-student-list input[data-student-id]').first();
    await absence.check();
    await page.locator('#group-roster-summary').getByText('3 present · 1 absent').waitFor();
    await page.locator('#clear-group-absences-btn').click();
    await page.locator('#group-roster-summary').getByText('4 present · 0 absent').waitFor();
    const absenceStorageKeys = await page.evaluate(() => [...window.groupsSmoke.stored.keys()]);
    if (!absenceStorageKeys.some(key => key.startsWith('teacher_group_absences:teacher-one:'))) {
        throw new Error(`Group absences were not scoped to the teacher: ${JSON.stringify(absenceStorageKeys)}`);
    }

    await page.locator('#randomize-groups-btn').click();
    if (await page.locator('.random-group-card').count() !== 2) {
        throw new Error('Feature-owned randomize listener did not render two groups.');
    }
    await page.locator('#copy-groups-btn').click();
    await page.waitForFunction(() => window.groupsSmoke.calls.copied.includes('Group 1:'));

    await page.locator('#group-restriction-student-a').selectOption('one');
    await page.locator('#group-restriction-student-b').selectOption('two');
    await page.locator('#save-group-restriction-btn').click();
    await page.waitForFunction(() => window.groupsSmoke.calls.create === 1);
    await page.locator('button[data-restriction-id="saved-pair"]').click();
    await page.waitForFunction(() => window.groupsSmoke.calls.remove === 1);

    const destroyedState = await page.evaluate(async () => {
        window.groupsSmoke.feature.destroy();
        document.querySelector('#randomize-groups-btn').click();
        await window.groupsSmoke.feature.show();
        return {
            classOptions: document.querySelector('#group-class-select').options.length,
            rosterText: document.querySelector('#group-student-list').textContent,
            restrictionText: document.querySelector('#group-restriction-list').textContent,
            resultsText: document.querySelector('#group-results').textContent,
            summary: document.querySelector('#group-roster-summary').textContent,
            restrictionCount: document.querySelector('#group-restriction-count').textContent,
            copyHidden: document.querySelector('#copy-groups-btn').classList.contains('hidden'),
            randomizeDisabled: document.querySelector('#randomize-groups-btn').disabled,
            saveDisabled: document.querySelector('#save-group-restriction-btn').disabled
        };
    });
    if (await page.locator('.random-group-card').count()) {
        throw new Error('Destroyed Groups feature retained its listeners.');
    }
    if (destroyedState.classOptions !== 1
        || destroyedState.rosterText.includes('Ana')
        || destroyedState.restrictionText.includes('Ana')
        || destroyedState.resultsText.includes('Ana')
        || destroyedState.summary !== '0 students'
        || destroyedState.restrictionCount !== '0 saved'
        || !destroyedState.copyHidden
        || !destroyedState.randomizeDisabled
        || destroyedState.saveDisabled) {
        throw new Error(`Destroyed Groups feature retained account state: ${JSON.stringify(destroyedState)}`);
    }

    const lazyAdapter = await page.evaluate(async () => {
        window.groupsSmoke.feature.destroy();
        const { installTeacherLazyFeatureMethods } = await import(
            `/js/teacherLazyFeatures.js?groups-lazy-smoke=${Date.now()}`
        );
        const roster = [
            ['one', 'Ana', 'Alba'],
            ['two', 'Ben', 'Bello'],
            ['three', 'Cora', 'Cruz'],
            ['four', 'Dani', 'Diaz']
        ].map(([id, firstName, lastName]) => ({
            id,
            studentProfile: { firstName, lastName, grade: '6', group: 'A' }
        }));
        class Manager {
            constructor() {
                this.authDisabled = true;
                this.currentUser = { id: 'teacher-two' };
                this.shownView = '';
            }

            ensureAuthenticated() { return true; }
            switchView(viewId) { this.shownView = viewId; }
            async getStudentRosterData() { return roster; }
            refreshIcons() {}
        }
        installTeacherLazyFeatureMethods(Manager);
        const manager = new Manager();
        await manager.showGroupsView();
        window.groupsSmoke.lazyManager = manager;
        return {
            shownView: manager.shownView,
            hasInternalClearMethod: typeof manager.clearGroupAbsences === 'function'
        };
    });
    if (lazyAdapter.shownView !== 'teacher-groups-view' || lazyAdapter.hasInternalClearMethod) {
        throw new Error(`Lazy Groups adapter contract failed: ${JSON.stringify(lazyAdapter)}`);
    }
    await page.locator('#group-student-list input[data-student-id]').first().check();
    await page.locator('#clear-group-absences-btn').click();
    await page.locator('#group-roster-summary').getByText('4 present · 0 absent').waitFor();

    const staleRoute = await page.evaluate(async () => {
        document.body.insertAdjacentHTML('beforeend', `
            <section id="teacher-overview-view" class="view hidden"></section>
            <section id="teacher-groups-view" class="view hidden"></section>
        `);
        const { installTeacherLazyFeatureMethods } = await import(
            `/js/teacherLazyFeatures.js?groups-route-lifecycle=${Date.now()}`
        );
        const { installTeacherRoutingMethods } = await import('/js/teacherRouting.js');
        const { installTeacherShellMethods } = await import('/js/teacherShell.js');
        class RouteManager {
            constructor() {
                this.authDisabled = true;
                this.isAuthenticated = true;
                this.currentUser = { id: 'teacher-route' };
                this.isApplyingRoute = false;
                this.pendingTeacherRoute = null;
                this.pendingTeacherNavigation = null;
                this.teacherNavigationGeneration = 0;
                this.routeReady = true;
                this.vocabularyMode = 'assign';
                this.libraryDrilldown = { subject: null, grade: null, trimester: null, month: null };
                this.overviewLoads = 0;
                this.rosterLoads = 0;
            }

            ensureAuthenticated() { return true; }
            getStudentRosterData() {
                this.rosterLoads += 1;
                return new Promise(() => {});
            }
            loadTeacherOverview() { this.overviewLoads += 1; }
            refreshIcons() {}
        }
        installTeacherLazyFeatureMethods(RouteManager);
        installTeacherRoutingMethods(RouteManager);
        installTeacherShellMethods(RouteManager);
        const manager = new RouteManager();
        history.replaceState(null, '', '#/teacher/groups');
        const oldRoute = manager.applyRoute({ view: 'groups' });
        manager.showTeacherSection('overview');
        const settled = await Promise.race([
            oldRoute.then(() => true),
            new Promise(resolve => setTimeout(() => resolve(false), 100))
        ]);
        return {
            settled,
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            applying: manager.isApplyingRoute,
            pendingRoute: manager.pendingTeacherRoute,
            overviewLoads: manager.overviewLoads,
            rosterLoads: manager.rosterLoads
        };
    });
    if (!staleRoute.settled
        || staleRoute.hash !== '#/teacher/overview'
        || staleRoute.activeView !== 'teacher-overview-view'
        || staleRoute.applying
        || staleRoute.pendingRoute
        || staleRoute.overviewLoads !== 1
        || staleRoute.rosterLoads !== 0) {
        throw new Error(`A stale Groups route replaced newer navigation: ${JSON.stringify(staleRoute)}`);
    }

    const latestOwnerRoute = await page.evaluate(async () => {
        const { installTeacherLazyFeatureMethods } = await import(
            `/js/teacherLazyFeatures.js?groups-route-owner=${Date.now()}`
        );
        const { installTeacherRoutingMethods } = await import('/js/teacherRouting.js');
        const { installTeacherShellMethods } = await import('/js/teacherShell.js');
        class RouteManager {
            constructor() {
                this.authDisabled = true;
                this.isAuthenticated = true;
                this.currentUser = { id: 'teacher-a' };
                this.isApplyingRoute = false;
                this.pendingTeacherRoute = null;
                this.pendingTeacherNavigation = null;
                this.teacherNavigationGeneration = 0;
                this.routeReady = true;
                this.vocabularyMode = 'assign';
                this.libraryDrilldown = { subject: null, grade: null, trimester: null, month: null };
                this.rosterOwners = [];
            }

            ensureAuthenticated() { return true; }
            async getStudentRosterData() {
                this.rosterOwners.push(this.currentUser?.id);
                return [];
            }
            loadTeacherOverview() {}
            refreshIcons() {}
        }
        installTeacherLazyFeatureMethods(RouteManager);
        installTeacherRoutingMethods(RouteManager);
        installTeacherShellMethods(RouteManager);
        const manager = new RouteManager();
        history.replaceState(null, '', '#/teacher/groups');
        const oldRoute = manager.applyRoute({ view: 'groups' });
        manager.showTeacherSection('overview');
        manager.currentUser = { id: 'teacher-b' };
        manager.disposeLoadedTeacherFeatures();
        manager.showTeacherSection('groups');
        await oldRoute;
        await new Promise(resolve => setTimeout(resolve, 50));
        const result = {
            hash: window.location.hash,
            activeView: document.querySelector('.view.active')?.id,
            rosterOwners: manager.rosterOwners,
            applying: manager.isApplyingRoute
        };
        manager.disposeLoadedTeacherFeatures();
        return result;
    });
    if (latestOwnerRoute.hash !== '#/teacher/groups'
        || latestOwnerRoute.activeView !== 'teacher-groups-view'
        || JSON.stringify(latestOwnerRoute.rosterOwners) !== JSON.stringify(['teacher-b'])
        || latestOwnerRoute.applying) {
        throw new Error(`Stale owner or ABA navigation reached Groups: ${JSON.stringify(latestOwnerRoute)}`);
    }

    const asyncLifecycle = await page.evaluate(async () => {
        window.groupsSmoke.lazyManager.disposeLoadedTeacherFeatures();
        const module = await import(`/js/teacherGroups.js?groups-lifecycle=${Date.now()}`);
        const rosterPending = [];
        const restrictionPending = [];
        const lifecycleFeature = module.createTeacherGroupsFeature({
            ensureAuthenticated: () => true,
            showView: () => {},
            loadRoster: () => new Promise(resolve => rosterPending.push(resolve)),
            getSession: () => ({ authDisabled: false, currentUser: { uid: 'teacher-lifecycle' } }),
            refreshIcons: () => {},
            repository: { list: () => new Promise(resolve => restrictionPending.push(resolve)) },
            feedback: { success: () => {}, error: () => {} },
            storage: { getItem: () => null, setItem: () => {} }
        });

        const oldShow = lifecycleFeature.show();
        const newShow = lifecycleFeature.show();
        rosterPending[1]([{
            id: 'new-student',
            studentProfile: { firstName: 'New', lastName: 'Teacher', grade: '9', group: 'B' }
        }]);
        restrictionPending[1]([]);
        await newShow;
        rosterPending[0]([{
            id: 'old-student',
            studentProfile: { firstName: 'Old', lastName: 'Teacher', grade: '6', group: 'A' }
        }]);
        restrictionPending[0]([]);
        await oldShow;
        const latestText = document.querySelector('#group-student-list').textContent;

        const disposedShow = lifecycleFeature.show();
        lifecycleFeature.destroy();
        rosterPending[2]([{
            id: 'disposed-student',
            studentProfile: { firstName: 'Disposed', lastName: 'Teacher', grade: '7', group: 'A' }
        }]);
        restrictionPending[2]([]);
        await disposedShow;
        return {
            latestText,
            disposedText: document.querySelector('#group-student-list').textContent,
            status: document.querySelector('#group-generator-status').textContent
        };
    });
    if (!asyncLifecycle.latestText.includes('New Teacher') || asyncLifecycle.latestText.includes('Old Teacher')) {
        throw new Error(`Groups latest-show contract failed: ${JSON.stringify(asyncLifecycle)}`);
    }
    if (asyncLifecycle.disposedText.includes('Disposed Teacher') || asyncLifecycle.status) {
        throw new Error(`Disposed Groups async work reached the DOM: ${JSON.stringify(asyncLifecycle)}`);
    }

    const accountSwitch = await page.evaluate(async () => {
        const { installTeacherLazyFeatureMethods } = await import(
            `/js/teacherLazyFeatures.js?groups-account-lazy=${Date.now()}`
        );
        const { installTeacherStudentProgressDataMethods } = await import(
            `/js/teacherStudentProgressDataMethods.js?groups-account-progress=${Date.now()}`
        );
        const { supabaseService } = await import('/js/supabaseService.js');
        const { teacherGroupRestrictionsRepository } = await import('/js/services/teacherGroupRestrictionsRepository.js');
        const originalRoster = supabaseService.listStudentIdentityRoster;
        const originalRestrictions = teacherGroupRestrictionsRepository.list;
        const rosterPending = [];
        supabaseService.listStudentIdentityRoster = () => new Promise(resolve => rosterPending.push(resolve));
        teacherGroupRestrictionsRepository.list = async () => [];

        class Manager {
            constructor() {
                this.authDisabled = false;
                this.currentUser = { id: 'teacher-a' };
                this.selectedStudents = new Set();
                this.allStudentData = [];
                this.filteredStudentData = [];
            }

            ensureAuthenticated() { return true; }
            switchView() {}
            refreshIcons() {}
        }
        installTeacherStudentProgressDataMethods(Manager);
        installTeacherLazyFeatureMethods(Manager);
        const manager = new Manager();

        try {
            const oldShow = manager.showGroupsView();
            while (rosterPending.length < 1) await new Promise(resolve => setTimeout(resolve, 0));
            manager.disposeLoadedTeacherFeatures();
            manager.clearStudentProgressSessionState();
            manager.currentUser = { id: 'teacher-b' };
            const newShow = manager.showGroupsView();
            while (rosterPending.length < 2) await new Promise(resolve => setTimeout(resolve, 0));

            rosterPending[1]([{
                id: 'new-b',
                studentProfile: { firstName: 'NEW_B', lastName: 'Student', grade: '9', group: 'B' }
            }]);
            await newShow;
            const beforeOld = {
                rosterText: document.querySelector('#group-student-list').textContent,
                classText: document.querySelector('#group-class-select').textContent,
                cachedIds: manager.allStudentData.map(student => student.id)
            };

            rosterPending[0]([{
                id: 'old-a',
                studentProfile: { firstName: 'OLD_A', lastName: 'Student', grade: '6', group: 'A' }
            }]);
            await oldShow;
            await Promise.resolve();
            const afterOld = {
                rosterText: document.querySelector('#group-student-list').textContent,
                classText: document.querySelector('#group-class-select').textContent,
                cachedIds: manager.allStudentData.map(student => student.id),
                rosterRequests: rosterPending.length
            };

            await manager.showGroupsView();
            afterOld.requestsAfterRepeatShow = rosterPending.length;
            return { beforeOld, afterOld };
        } finally {
            manager.disposeLoadedTeacherFeatures();
            supabaseService.listStudentIdentityRoster = originalRoster;
            teacherGroupRestrictionsRepository.list = originalRestrictions;
        }
    });
    if (!accountSwitch.beforeOld.rosterText.includes('NEW_B Student')
        || accountSwitch.beforeOld.rosterText.includes('OLD_A')
        || JSON.stringify(accountSwitch.beforeOld) !== JSON.stringify({
            rosterText: accountSwitch.afterOld.rosterText,
            classText: accountSwitch.afterOld.classText,
            cachedIds: accountSwitch.afterOld.cachedIds
        })
        || accountSwitch.afterOld.rosterRequests !== 2
        || accountSwitch.afterOld.requestsAfterRepeatShow !== 2) {
        throw new Error(`Groups account-switch isolation failed: ${JSON.stringify(accountSwitch)}`);
    }

    const staleRestrictionSave = await page.evaluate(async () => {
        const module = await import(`/js/teacherGroups.js?groups-save-lifecycle=${Date.now()}`);
        let resolveCreate;
        let createCalls = 0;
        const feedback = [];
        const feature = module.createTeacherGroupsFeature({
            ensureAuthenticated: () => true,
            showView: () => {},
            loadRoster: async () => [
                { id: 'one', studentProfile: { firstName: 'One', lastName: 'Student', grade: '6', group: 'A' } },
                { id: 'two', studentProfile: { firstName: 'Two', lastName: 'Student', grade: '6', group: 'A' } }
            ],
            getSession: () => ({ authDisabled: false, currentUser: { id: 'teacher-save' } }),
            refreshIcons: () => {},
            repository: {
                list: async () => [],
                create() {
                    createCalls += 1;
                    return new Promise(resolve => { resolveCreate = resolve; });
                }
            },
            feedback: {
                success: message => feedback.push(message),
                error: message => feedback.push(message)
            },
            storage: { getItem: () => null, setItem: () => {} }
        });
        await feature.show();
        document.querySelector('#group-restriction-student-a').value = 'one';
        document.querySelector('#group-restriction-student-b').value = 'two';
        document.querySelector('#save-group-restriction-btn').click();
        while (!resolveCreate) await new Promise(resolve => setTimeout(resolve, 0));
        feature.destroy();
        resolveCreate({ id: 'old-save', studentAId: 'one', studentBId: 'two' });
        await new Promise(resolve => setTimeout(resolve, 0));
        return {
            createCalls,
            restrictionText: document.querySelector('#group-restriction-list').textContent,
            status: document.querySelector('#group-restriction-status').textContent,
            saveDisabled: document.querySelector('#save-group-restriction-btn').disabled,
            feedback
        };
    });
    if (staleRestrictionSave.createCalls !== 1
        || staleRestrictionSave.restrictionText.includes('One Student')
        || staleRestrictionSave.status
        || staleRestrictionSave.saveDisabled
        || staleRestrictionSave.feedback.length) {
        throw new Error(`Disposed Groups save reached shared UI: ${JSON.stringify(staleRestrictionSave)}`);
    }

    if (problems.length) throw new Error(problems.join('\n'));
    console.log('Teacher Groups factory smoke passed.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
