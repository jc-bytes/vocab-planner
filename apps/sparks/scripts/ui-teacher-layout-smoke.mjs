import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const port = Number(process.env.UI_TEACHER_LAYOUT_PORT || 8578);
const baseUrl = `http://127.0.0.1:${port}`;
const widths = [320, 360, 390, 430, 768, 1024, 1280];
const screenshots = process.env.UI_TEACHER_LAYOUT_SCREENSHOTS;
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/', host: '127.0.0.1', port });
    const html = (await readFile(new URL('../teacher.html', import.meta.url), 'utf8'))
        .replace(/<script[^>]*src="js\/teacher\.js"[^>]*><\/script>/, '');
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('**/__teacher-layout.html', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(`${baseUrl}/__teacher-layout.html`);
    await page.evaluate(async () => {
        const { createTeacherClassWorkspace } = await import('/js/teacherClassWorkspace.js');
        const { createTeacherAssignmentsWorkspace } = await import('/js/teacherAssignmentsWorkspace.js');
        const { createSchoolAdminView } = await import('/js/schoolAdminView.js');
        const { teacherSubjectSettingsMethods } = await import('/js/teacherSubjectSettingsMethods.js');
        const classes = Array.from({ length: 9 }, (_, i) => ({ id: `class-${i}`, name: `Technology ${6 + Math.floor(i / 3)}${'ABC'[i % 3]}`, subject: { name: 'Technology' }, school_year: 2026, canTeach: true }));
        const assignments = classes.map((c, i) => ({ id: `assignment-${i}`, class_id: c.id, kind: 'vocabulary', title: i ? 'Technology vocabulary and evidence' : 'A long assignment title about checking sources, hoaxes, and online information', release_at: '2026-10-01T00:00:00Z' }));
        const repository = {
            listClasses: async () => classes, listSubjects: async () => [{ id: 'technology', name: 'Technology' }],
            listAssignments: async () => assignments, listInvitations: async () => [],
            getRoster: async () => [{ studentId: 'student', name: 'Example Student With A Longer Name', email: 'example@test.invalid' }],
            getResults: async () => [], assignmentFeedback: async () => []
        };
        const settingsTemplate = document.querySelector('#teacher-data-management-view-template');
        settingsTemplate.replaceWith(settingsTemplate.content.cloneNode(true));
        const roots = {
            classes: document.querySelector('#teacher-classes-view'),
            assignments: document.querySelector('#teacher-assignments-view'),
            schools: document.querySelector('#teacher-administration-view'),
            settings: document.querySelector('#teacher-data-management-view')
        };
        const school = { id: 'school', name: 'Example School', active: true, roles: ['school_admin'] };
        const context = { getAccountId: () => 'teacher', getSchoolId: () => 'school', getAccess: () => ({ platformAdmin: true, schools: [school] }), getSchool: () => school, subscribe: () => () => {} };
        const schoolData = {
            listYears: async () => [{ year: 2026, label: '2026', archived: false }],
            listMyInvitations: async () => [], listInvitations: async () => [], listPlatformAdmins: async () => [],
            listAudit: async () => [{ created_at: '2026-10-13T12:00:00Z', action: 'member.changed', target_user_id: 'technical-identifier' }],
            listMembersPage: async () => ({ total: 25, members: Array.from({ length: 25 }, (_, i) => ({ user_id: `student-${i}`, display_name: `Example Student ${i + 1}`, active: true, grade: '6', section: 'A', roles: ['student'] })) })
        };
        const classView = createTeacherClassWorkspace({ root: roots.classes, getUserId: () => 'teacher', repository, schoolRepository: schoolData });
        const assignmentView = createTeacherAssignmentsWorkspace({ root: roots.assignments, getUserId: () => 'teacher', repository, onPublish() {} });
        const schoolView = createSchoolAdminView({ root: roots.schools, context, repository: schoolData });
        const settingsOwner = { subjects: [{ slug: 'technical-identifier', name: 'Technology', color: '#2563eb', active: true, sortOrder: 0 }], getSubjects() { return this.subjects; }, updateSubjectSelect() {} };
        teacherSubjectSettingsMethods.renderSubjectManager.call(settingsOwner);
        document.querySelector('#teacher-tab-shell').classList.remove('hidden');
        document.querySelector('#teacher-school-name').textContent = school.name;
        window.layoutShow = async section => {
            for (const view of document.querySelectorAll('.teacher-main > .view')) { view.classList.add('hidden'); view.classList.remove('active'); }
            for (const tab of document.querySelectorAll('.teacher-tabs [data-section]')) {
                const active = tab.dataset.section === ({ schools: 'administration', settings: 'settings', classes: 'classes', assignments: 'assignments' })[section];
                tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active));
            }
            const root = roots[section]; root.classList.remove('hidden'); root.classList.add('active');
            if (section === 'classes') await classView.show();
            if (section === 'assignments') await assignmentView.show();
            if (section === 'schools') await schoolView.show();
        };
        await window.layoutShow('classes');
    });
    if (screenshots) await mkdir(screenshots, { recursive: true });
    for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        for (const section of ['classes', 'assignments', 'schools', 'settings']) {
            await page.evaluate(section => window.layoutShow(section), section);
            await page.waitForTimeout(80);
            const measurements = await page.evaluate(() => {
                const main = document.querySelector('.teacher-main');
                const visible = element => element.getClientRects().length > 0;
                const offenders = [...main.querySelectorAll('input, select, button, summary')].filter(visible)
                    .filter(element => { const rect = element.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1; })
                    .map(element => element.getAttribute('aria-label') || element.textContent);
                return { overflow: document.documentElement.scrollWidth > innerWidth + 1, offenders, mainShadow: getComputedStyle(main).boxShadow };
            });
            assert.equal(measurements.overflow, false, `${section} has page overflow at ${width}px`);
            assert.deepEqual(measurements.offenders, [], `${section} controls clipped at ${width}px`);
            assert.equal(measurements.mainShadow, 'none');
            if (section === 'classes') {
                const grid = await page.locator('.teacher-class-grid').evaluate(element => {
                    const available = element.getBoundingClientRect().width;
                    const cards = [...element.children].map(child => child.getBoundingClientRect());
                    return { available, columns: cards.filter(card => Math.abs(card.top - cards[0].top) < 1).length };
                });
                assert.equal(grid.columns, grid.available >= 768 ? 3 : grid.available >= 480 ? 2 : 1, `Class columns at ${width}px`);
            }
            if (section === 'schools') {
                assert.equal(await page.getByRole('tab', { name: 'Members', exact: true }).getAttribute('aria-selected'), 'true');
                assert.equal(await page.getByLabel('School name', { exact: true }).isVisible(), false);
                assert.equal(await page.getByRole('button', { name: 'Save member', exact: true }).count(), 0);
                await page.locator('summary').filter({ hasText: /^Example Student 1$/ }).click();
                assert.equal(await page.getByRole('button', { name: 'Save member', exact: true }).count(), 1);
                await page.locator('summary').filter({ hasText: /^Example Student 1$/ }).click();
            }
            if (screenshots && [390, 1280].includes(width)) await page.screenshot({ path: `${screenshots}/${section}-${width}.png`, fullPage: false });
        }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.layoutShow('schools'));
    await page.getByRole('tab', { name: 'Members', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: 'Invitations', exact: true }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await page.getByRole('tab', { name: 'Platform administration', exact: true }).getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Home');
    assert.equal(await page.getByRole('tab', { name: 'Members', exact: true }).getAttribute('aria-selected'), 'true');
    console.log('Teacher layout passed: four populated screens at seven widths, compact editors, permission-preserving sections and keyboard navigation.');
} finally {
    await browser?.close();
    server?.kill();
}
