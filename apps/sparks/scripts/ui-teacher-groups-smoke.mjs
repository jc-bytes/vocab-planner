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
        window.groupsSmoke = { feature, calls };
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

    await page.evaluate(() => {
        window.groupsSmoke.feature.destroy();
        document.querySelector('#group-results').innerHTML = '';
        document.querySelector('#randomize-groups-btn').click();
    });
    if (await page.locator('.random-group-card').count()) {
        throw new Error('Destroyed Groups feature retained its listeners.');
    }

    await page.evaluate(() => window.groupsSmoke.feature.show());
    await page.locator('#randomize-groups-btn').click();
    if (await page.locator('.random-group-card').count() !== 2) {
        throw new Error('Groups feature did not rebind after destroy.');
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

    if (problems.length) throw new Error(problems.join('\n'));
    console.log('Teacher Groups factory smoke passed.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
