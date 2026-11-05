import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const baseUrl = 'http://127.0.0.1:8156';
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port: 8156 });
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl);
    await page.evaluate(async () => {
        const template = new DOMParser().parseFromString(await fetch('/teacher.html').then(r => r.text()), 'text/html');
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(item => item.remove());
        for (const link of template.querySelectorAll('link[rel="stylesheet"]')) document.head.append(link.cloneNode(true));
        document.body.className = template.body.className;
        document.body.innerHTML = template.body.innerHTML;
        document.querySelectorAll('script').forEach(item => item.remove());
        document.querySelectorAll('.view').forEach(item => item.classList.add('hidden'));
        document.querySelector('#teacher-tab-shell').classList.remove('hidden');
        document.querySelectorAll('.teacher-tab').forEach(item => { item.classList.remove('active', 'primary-nav__item--active'); item.setAttribute('aria-selected', 'false'); });
        document.querySelector('#tab-students').classList.add('active', 'primary-nav__item--active');
        document.querySelector('#tab-students').setAttribute('aria-selected', 'true');
        document.querySelector('.teacher-top-bar').classList.remove('hidden');
        document.querySelector('#teacher-top-bar-section').textContent = 'Students';
        document.querySelector('#teacher-mobile-section-label').textContent = 'Students';
        const root = document.querySelector('#teacher-class-students-view'); root.classList.remove('hidden'); root.classList.add('active');
        const { createTeacherClassWorkspace } = await import('/js/teacherClassWorkspace.js');
        const { installTeacherRoutingMethods } = await import('/js/teacherRouting.js');
        class Router {} installTeacherRoutingMethods(Router); const router = new Router();
        window.progressCalls = []; window.progressReadCalls = []; window.progressOwner = 'teacher-a';
        const roster = ['Ana', 'Ben', 'Cara', 'Dan', 'Eva'].map((name, i) => ({ name, studentId: String(i), email: `${name}@example.test` }));
        const repository = {
            listClasses: async () => [{ id: 'class-a', name: '8A', school_year: 2026, subject: { name: 'Technology' } }],
            getRoster: async (classId, { signal }) => {
                window.progressReadCalls.push('roster');
                if (window.holdProgressRoster) {
                    window.holdProgressRoster = false; window.oldProgressRosterSignal = signal;
                    return new Promise(resolve => { window.resolveProgressRoster = resolve; });
                }
                if (window.failProgressRoster) throw new Error('Fixture roster request failed');
                return roster;
            },
            listInvitations: async () => {
                window.progressReadCalls.push('invitations');
                if (window.failProgressInvitations) throw new Error('Fixture invitation request failed');
                return [];
            },
            classGradebook: async () => {
                window.progressReadCalls.push('gradebook');
                return {assignments:[{id:'vocab-a',title:'Vocabulary one',releaseAt:'2026-01-01',grading:{enabled:false,maxPoints:100,bonusPerActivity:0,bonusCap:null,capAtMaxPoints:false},revision:0}],students:roster.map(student=>({...student,grades:[{assignmentId:'vocab-a',enabled:false,status:'ungraded',published:null}]}))};
            },
            classProgress: async (classId, from, to, { signal }) => {
                window.progressReadCalls.push('progress');
                window.progressCalls.push({ classId, from, to });
                if (window.holdProgress) { window.holdProgress = false; return new Promise(resolve => { window.resolveOldProgress = resolve; }); }
                if (window.failProgress) throw new Error('Fixture failure');
                return roster.map((student, i) => ({ studentId: student.studentId, required: i === 4 ? 0 : 10, completed: [0, 4, 10, 10, 0][i], review: i === 1 ? 2 : 0, unknown: i === 3 ? 1 : 0 }));
            }
        };
        const calendar = { schoolYear: 2026, trimesters: { IT: { startDate: '2026-01-01', endDate: '2026-03-31' }, IIT: { startDate: '2026-04-01', endDate: '2026-06-30' }, IIIT: { startDate: '2026-07-01', endDate: '2026-12-31' } } };
        window.progressWorkspace = createTeacherClassWorkspace({ root, repository, getUserId: () => window.progressOwner, getSchoolCalendar: async () => { window.progressReadCalls.push('calendar'); return calendar; },
            onNavigate: context => window.progressWorkspace.show(context),
            onProgressState: context => { window.progressContext = context; history.replaceState(null, '', router.buildRoute({ view: 'students', ...context })); },
            onGradebookState: context => { window.gradebookContext = context; history.replaceState(null, '', router.buildRoute({view:'students',...context})); },
            onStudent: context => { window.openedProgressStudent = context; } });
        await window.progressWorkspace.show({ classId: 'class-a', tab: 'students' });
    });
    const isolatedReads = await page.evaluate(async () => {
        const root = document.querySelector('#teacher-class-students-view');
        const show = async (mode, failInvitations, failRoster = false) => {
            window.progressReadCalls = []; window.failProgressInvitations = failInvitations; window.failProgressRoster = failRoster;
            await window.progressWorkspace.show({ classId: 'class-a', tab: 'students',
                ...(mode === 'progress' ? { progressContext: {} } : mode === 'grades' ? { gradebookContext: {} } : {}) });
            return { calls: [...window.progressReadCalls].sort(), progress: Boolean(root.querySelector('.class-progress')),
                grades: Boolean(root.querySelector('.vocabulary-gradebook')), error: Boolean(root.querySelector('.section-load-error')),
                retry: [...root.querySelectorAll('button')].some(button => button.textContent === 'Try again'), busy: root.getAttribute('aria-busy') };
        };
        const result = {
            progress: await show('progress', true),
            grades: await show('grades', true, true),
            roster: await show('roster', false),
            rosterFailure: await show('roster', true)
        };
        window.failProgressInvitations = window.failProgressRoster = false;
        await window.progressWorkspace.show({ classId: 'class-a', tab: 'students' });
        return result;
    });
    assert.deepEqual(isolatedReads.progress, { calls: ['calendar', 'progress', 'roster'], progress: true, grades: false, error: false, retry: false, busy: 'false' });
    assert.deepEqual(isolatedReads.grades, { calls: ['calendar', 'gradebook'], progress: false, grades: true, error: false, retry: false, busy: 'false' });
    assert.deepEqual(isolatedReads.roster.calls, ['invitations', 'roster']);
    assert.equal(isolatedReads.rosterFailure.error, true, 'Roster retains its invitation error and retry behavior.');
    assert.equal(isolatedReads.rosterFailure.retry, true, 'The safe Roster recovery still offers an in-place retry.');

    const obsoleteRoster = await page.evaluate(async () => {
        window.progressReadCalls = []; window.holdProgressRoster = true; window.resolveProgressRoster = null;
        const oldShow = window.progressWorkspace.show({ classId: 'class-a', tab: 'students', progressContext: {} });
        while (!window.resolveProgressRoster) await new Promise(resolve => setTimeout(resolve, 0));
        const tabsWhileLoading = [...document.querySelectorAll('.class-detail-tab')].map(tab => tab.textContent);
        const busyWhileLoading = document.querySelector('#teacher-class-students-view').getAttribute('aria-busy');
        await window.progressWorkspace.show({ classId: 'class-a', tab: 'students', gradebookContext: {} });
        const aborted = window.oldProgressRosterSignal.aborted;
        window.resolveProgressRoster([{ studentId: 'old-only', name: 'Obsolete roster', email: 'old@example.test' }]);
        await oldShow;
        const result = { aborted, tabsWhileLoading, busyWhileLoading,
            calls: [...window.progressReadCalls].sort(),
            grades: Boolean(document.querySelector('.vocabulary-gradebook')), progress: Boolean(document.querySelector('.class-progress')),
            staleText: document.querySelector('#teacher-class-students-view').textContent.includes('Obsolete roster') };
        await window.progressWorkspace.show({ classId: 'class-a', tab: 'students' });
        return result;
    });
    assert.deepEqual(obsoleteRoster, { aborted: true, tabsWhileLoading: ['Roster', 'Trimester progress', 'Grades'], busyWhileLoading: 'true',
        calls: ['calendar', 'calendar', 'gradebook', 'roster'], grades: true, progress: false, staleText: false });
    await page.getByRole('button', { name: 'Trimester progress', exact: true }).click();
    await page.getByRole('table', { name: 'Required work completion' }).getByText('Complete', { exact: true }).waitFor();
    assert.equal(await page.locator('progress[data-band="0"]').count(), 1);
    assert.equal(await page.locator('progress[data-band="2"]').count(), 1);
    assert.equal(await page.locator('progress[data-band="4"]').count(), 1);
    assert.equal(await page.locator('progress[data-band="unknown"]').count(), 1);
    assert.equal(await page.locator('progress[data-band="empty"]').count(), 1);
    const ben = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Ben', exact: true }) });
    assert.match(await ben.textContent(), /4 \/ 10.*40%.*2/);
    await page.locator('.class-progress-filter-menu > summary').click();
    await page.getByLabel('Unfinished only').check();
    assert.equal(await page.getByRole('button', { name: 'Cara', exact: true }).count(), 0);
    await page.getByLabel('Unfinished only').uncheck();
    await page.locator('.class-progress-filter-menu > summary').click();
    await page.getByLabel('Period', { exact: true }).selectOption('custom');
    await page.getByLabel('Assigned from').fill('2026-03-31'); await page.getByLabel('Assigned through').fill('2026-04-01');
    await page.getByRole('button', { name: 'Apply dates', exact: true }).click();
    await page.getByText(/Assigned between 2026-03-31 and 2026-04-01/).waitFor();
    assert.equal(await page.evaluate(() => window.progressCalls.at(-1).to), '2026-04-01');
    await page.getByLabel('Search progress students').fill('Ben');
    await page.getByRole('button', { name: 'Ben', exact: true }).click();
    const opened = await page.evaluate(() => window.openedProgressStudent);
    assert.equal(opened.tab, 'assigned'); assert.equal(opened.progressContext.from, '2026-03-31'); assert.equal(opened.progressContext.search, 'Ben');
    await page.evaluate(async () => {
        window.progressWorkspace.hide();
        await window.progressWorkspace.show({ classId: 'class-a', tab: 'students', progressContext: window.openedProgressStudent.progressContext });
    });
    assert.equal(await page.getByLabel('Search progress students').inputValue(), 'Ben');
    await page.getByLabel('Search progress students').fill('');
    // A slow, obsolete range cannot overwrite a newer result, even if transport ignores abort.
    await page.evaluate(() => { window.holdProgress = true; });
    await page.getByLabel('Period', { exact: true }).selectOption('1');
    await page.waitForFunction(() => Boolean(window.resolveOldProgress));
    await page.getByLabel('Period', { exact: true }).selectOption('2');
    await page.getByText(/Assigned between 2026-04-01 and 2026-06-30/).waitFor();
    await page.evaluate(() => window.resolveOldProgress([]));
    assert.equal(await page.getByRole('button', { name: 'Ben', exact: true }).count(), 1);
    await page.evaluate(() => { window.failProgress = true; });
    await page.getByLabel('Period', { exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Retry progress', exact: true }).waitFor();
    assert.equal(await page.locator('progress[data-band="unknown"]').count(), 5);
    await page.evaluate(() => { window.failProgress = false; });
    await page.getByRole('button', { name: 'Retry progress', exact: true }).click();
    await page.getByText('Complete', { exact: true }).waitFor();
    await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
    await page.screenshot({ path: '/tmp/sparks-trimester-progress-desktop.png', fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '/tmp/sparks-trimester-progress-mobile.png', fullPage: true, animations: 'disabled' });
    await page.getByRole('button', {name:'Grades',exact:true}).click();
    await page.getByRole('region', {name:'Vocabulary grades',exact:true}).waitFor();
    await page.getByLabel('Grade student', {exact:true}).waitFor();
    await page.getByRole('button', {name:'Open student work',exact:true}).click();
    const gradeNavigation = await page.evaluate(() => window.openedProgressStudent);
    assert.ok(gradeNavigation.gradebookContext);
    assert.equal(gradeNavigation.progressContext, undefined);
    await page.evaluate(() => { window.progressOwner = 'teacher-b'; window.progressWorkspace.hide(); });
    assert.equal(await page.locator('progress').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Class progress browser checks passed: per-view required reads, unrelated invitation/roster failure isolation, loading tabs, obsolete initial roster cancellation, bands, review counts, custom dates, filtered student navigation, return state, stale reads, retry, mobile and account isolation.');
} finally {
    await browser?.close(); server?.kill();
}
