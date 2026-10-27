import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { teacherFeatureIds as ids, installTeacherFeatureFixture as fixture } from './lib/teacher-feature-fixture.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port = Number(process.env.UI_TEACHER_PROGRESS_FEATURE_PORT || 19866), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_PROGRESS_FEATURE_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
const featurePath = built ? `/${manifest['js/teacherStudentProgressFeature.js'].file}` : '/js/teacherStudentProgressFeature.js';
let browser, server;
const settled = page => page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const scenario of ['home', 'headless', 'profile']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const f = await fixture(page), requests = [];
        page.on('request', request => { if (new URL(request.url()).pathname === featurePath) requests.push(request.url()); });
        await page.goto(`${baseUrl}/teacher.html#/teacher/overview`);
        await settled(page).catch(async error => {
            console.error('Synthetic teacher startup diagnostic:', JSON.stringify({ errors: f.errors, calls: Object.fromEntries([...new Set(f.calls)].map(name => [name, f.calls.filter(value => value === name).length])),
                state: await page.evaluate(() => ({ app: !!window.teacherApp, authenticated: window.teacherApp?.isAuthenticated,
                    ready: window.teacherApp?.routeReady, applying: window.teacherApp?.isApplyingRoute,
                    status: document.querySelector('#teacher-auth-error')?.textContent })) }));
            throw error;
        });
        assert.equal(requests.length, 0, 'Cold Home does not fetch progress feature');
        assert.equal(await page.evaluate(() => typeof teacherApp.fetchStudentProgressPage), 'undefined');
        if (scenario === 'headless') {
            const result = await page.evaluate(async () => {
                const route = location.hash;
                const rows = await teacherApp.getStudentRosterData();
                return { ids: rows.map(row => row.id), same: rows === teacherApp.allStudentData, route, after: location.hash,
                    createDisabled: document.querySelector('#create-student-account-btn').disabled, resetDisabled: document.querySelector('#reset-student-password-btn').disabled };
            });
            assert.deepEqual(result.ids, [ids.student]); assert.equal(result.same, true); assert.equal(result.route, result.after);
            assert.equal(result.createDisabled, true); assert.equal(result.resetDisabled, true);
            assert.equal(requests.length, 1);
        } else if (scenario === 'profile') {
            await page.evaluate(async ids => {
                teacherApp.selectTeacherClass(ids.class);
                const route = { view: 'student-profile', studentId: ids.student, classId: ids.class };
                teacherApp.setRoute(route); await teacherApp.applyRoute(route);
            }, ids);
            await page.locator('#teacher-student-profile-view.active #student-profile-content:not(.hidden)').waitFor();
            assert.match(await page.locator('#detail-student-name').innerText(), /Fixture Student/);
            assert.equal(requests.length, 1);
            assert.ok(f.calls.includes('class_roster_v1')); assert.ok(f.calls.includes('get_student_progress_school_v3'));
            await page.evaluate(() => teacherApp.clearStudentProgressSessionState());
            assert.deepEqual(await page.evaluate(() => teacherApp.allStudentData), []);
        }
        assert.deepEqual(f.errors, []);
        console.log(`${scenario}: real teacher shell lazy roster/profile ownership passed`);
        await context.close();
    }
    for (const change of ['reset', 'account']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const f = await fixture(page);
        let release, requested;
        const waiting = new Promise(resolve => { requested = resolve; });
        await page.route(`**${featurePath}`, async route => {
            requested(); await new Promise(resolve => { release = resolve; }); await route.continue();
        });
        await page.goto(`${baseUrl}/teacher.html#/teacher/overview`); await settled(page);
        const before = await page.evaluate(() => Object.getOwnPropertyNames(Object.getPrototypeOf(teacherApp)));
        await page.evaluate(ids => {
            teacherApp.selectTeacherClass(ids.class);
            const route = { view: 'student-profile', studentId: ids.student, classId: ids.class };
            teacherApp.setRoute(route); window.heldProfile = teacherApp.applyRoute(route);
        }, ids);
        await waiting;
        await page.evaluate(change => {
            teacherApp.clearStudentProgressSessionState();
            if (change === 'account') {
                teacherApp.currentUser = { uid: '66666666-6666-4666-8666-666666666666' };
                teacherApp.invalidateTeacherNavigation();
                teacherApp.setRoute({ view: 'overview' });
                void teacherApp.applyRoute({ view: 'overview' });
            }
        }, change);
        release();
        await page.evaluate(() => window.heldProfile);
        await settled(page);
        assert.equal(f.calls.includes('get_student_progress_school_v3'), false, 'Obsolete feature import cannot start profile reads');
        assert.deepEqual(await page.evaluate(() => teacherApp.allStudentData), []);
        assert.deepEqual(await page.evaluate(() => Object.getOwnPropertyNames(Object.getPrototypeOf(teacherApp))), before);
        if (change === 'reset') {
            await page.evaluate(ids => teacherApp.applyRoute({ view: 'student-profile', studentId: ids.student, classId: ids.class }), ids);
            await page.locator('#teacher-student-profile-view.active #student-profile-content:not(.hidden)').waitFor();
        } else assert.ok(new URL(page.url()).hash.includes('overview'));
        assert.deepEqual(f.errors, []);
        console.log(`held-${change}: no obsolete reads, prototype mutation or private snapshot; retry/navigation usable`);
        await context.close();
    }

} finally { await browser?.close(); server?.kill(); }
