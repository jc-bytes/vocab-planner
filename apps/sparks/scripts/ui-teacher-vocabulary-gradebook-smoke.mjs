import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const baseUrl = 'http://127.0.0.1:8168';
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port: 8168 });
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl);
    await page.evaluate(async () => {
        const template = new DOMParser().parseFromString(await fetch('/teacher.html').then(r => r.text()), 'text/html');
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(item => item.remove());
        for (const link of template.querySelectorAll('link[rel="stylesheet"]')) document.head.append(link.cloneNode(true));
        document.body.className = template.body.className; document.body.innerHTML = template.body.innerHTML;
        document.querySelectorAll('script').forEach(item => item.remove());
        document.querySelectorAll('.view').forEach(item => item.classList.add('hidden'));
        document.querySelector('#teacher-tab-shell').classList.remove('hidden');
        document.querySelectorAll('.teacher-tab').forEach(item => { item.classList.remove('active', 'primary-nav__item--active'); item.setAttribute('aria-selected', 'false'); });
        document.querySelector('#tab-students').classList.add('active', 'primary-nav__item--active'); document.querySelector('#tab-students').setAttribute('aria-selected', 'true');
        document.querySelector('.teacher-top-bar').classList.remove('hidden'); document.querySelector('#teacher-top-bar-section').textContent = 'Students'; document.querySelector('#teacher-mobile-section-label').textContent = 'Students';
        const root = document.querySelector('#teacher-class-students-view'); root.classList.remove('hidden'); root.classList.add('active', 'classrooms');
        const { mountVocabularyGradebook } = await import('/js/teacherVocabularyGradebook.js');
        const config = { enabled: true, maxPoints: 100, bonusPerActivity: 5, bonusCap: 10, capAtMaxPoints: false };
        const assignments = [
            { id: 'a', title: 'Digital citizenship', releaseAt: '2026-10-01T12:00Z', grading: config, revision: 0 },
            { id: 'b', title: 'Practice vocabulary', releaseAt: '2026-10-02T12:00Z', grading: { ...config, enabled: false }, revision: 0 },
            { id: 'c', title: 'Old content needing review', releaseAt: '2026-10-03T12:00Z', grading: config, revision: 0 },
            { id: 'd', title: 'Spreadsheet formulas', releaseAt: '2026-10-04T12:00Z', grading: { ...config, maxPoints: 50 }, revision: 0 }
        ];
        const grade = (assignmentId, basePoints, bonusPoints, maxPoints, complete) => ({ assignmentId, enabled: true, status: 'provisional', requiredCount: 2, requiredCompleted: complete, additionalCount: 2, additionalCompleted: bonusPoints ? 1 : 0, basePoints, bonusPoints, earnedPoints: basePoints + bonusPoints, maxPoints, percent: (basePoints + bonusPoints) / maxPoints * 100,
            grading: assignments.find(a => a.id === assignmentId).grading,
            activities: [{ activityType: 'flashcards', required: true, complete: complete > 0, points: complete > 0 ? maxPoints / 2 : 0 }, { activityType: 'matching', required: true, complete: complete === 2, points: complete === 2 ? maxPoints / 2 : 0 }, { activityType: 'quiz', required: false, complete: Boolean(bonusPoints), points: bonusPoints }], published: null });
        const students = ['Ana Rivera', 'Ben Torres'].map((name, index) => ({ studentId: String(index), name, email: `${index}@example.test`, grades: [grade('a', index ? 50 : 100, index ? 0 : 5, 100, index ? 1 : 2), { assignmentId: 'b', enabled: false, status: 'ungraded', published: null }, { assignmentId: 'c', enabled: true, status: 'unavailable', reason: 'A required activity is not playable.', published: null }, grade('d', index ? 0 : 50, 0, 50, index ? 0 : 2)] }));
        const saved = structuredClone(students[0].grades[0]); delete saved.published; saved.bonusPoints = 0; saved.earnedPoints = 100; saved.percent = 100; saved.additionalCompleted = 0; saved.activities[2].complete = false; saved.activities[2].points = 0; saved.publishedAt = '2026-10-02T12:00Z'; students[0].grades[0].published = saved;
        students[0].grades[3].published = structuredClone(students[0].grades[3]); delete students[0].grades[3].published.published;
        window.gradeCalls = []; window.gradeData = { assignments, students }; window.gradeCurrent = true; window.gradeController = new AbortController();
        const repository = {
            async classGradebook(classId, from, to, options) {
                window.gradeCalls.push(['read', classId, from, to]);
                if (window.holdGrades) { window.holdGrades = false; return new Promise(resolve => { window.resolveOldGrades = resolve; }); }
                if (window.failGrades) throw new Error('Fixture read failed');
                return structuredClone(window.gradeData);
            },
            async setAssignmentGrading(assignmentId, settings, revision, options) {
                window.gradeCalls.push(['save', assignmentId, settings, revision, options.ownerUserId]);
                if (window.failSave) throw new Error('Grading settings changed. Reload grades.');
                const assignment = assignments.find(item => item.id === assignmentId); assignment.grading = settings; assignment.revision++;
                for (const student of students) { const result = student.grades.find(item => item.assignmentId === assignmentId); result.enabled = settings.enabled; result.grading = settings; }
            },
            async publishVocabularyGrades(assignmentId, revision, options) {
                window.gradeCalls.push(['publish', assignmentId, revision, options.ownerUserId]);
                const assignment = assignments.find(item => item.id === assignmentId); assignment.revision++; assignment.publishedAt = '2026-11-03T12:00Z';
                for (const student of students) { const result = student.grades.find(item => item.assignmentId === assignmentId); const published = structuredClone(result); delete published.published; published.publishedAt = assignment.publishedAt; result.published = published; }
            }
        };
        window.mountGradebook = async () => {
            root.replaceChildren(); window.gradeController.abort(); window.gradeController = new AbortController();
            await mountVocabularyGradebook({ root, active: { id: 'class-a', school_year: 2026 }, calendar: { schoolYear: 2026, trimesters: { IIIT: { startDate: '2026-09-01', endDate: '2026-12-31' } } }, timeZone: 'America/Panama', repository, signal: window.gradeController.signal, isCurrent: () => window.gradeCurrent, ownerUserId: 'teacher-a',
                initial: { period: '3', from: '2026-09-01', to: '2026-12-31' }, onStateChange: context => { window.gradeState = context; }, onStudent: context => { window.openedGradeStudent = context; } });
        };
        await window.mountGradebook();
    });
    const table = page.getByRole('table', { name: 'Class vocabulary grades' });
    await table.waitFor();
    assert.equal(await table.locator('tbody tr').count(), 2);
    assert.match(await table.locator('tbody tr').first().textContent(), /105 \/ 100.*105%.*Published 100 \/ 100.*Live changes/);
    assert.match(await table.locator('tbody tr').first().textContent(), /103.3%.*155 \/ 150 points.*2\/3 measurable/);
    await table.getByRole('button', { name: 'Ana Rivera, Digital citizenship: 105 of 100 points' }).click();
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByRole('dialog').textContent(), /Live calculation.*105 \/ 100 points.*Last published grade.*100 \/ 100 points/s);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await table.getByRole('button', { name: 'Grading settings for Digital citizenship', exact: true }).click();
    await page.getByLabel('Required work points', { exact: true }).fill('0.01');
    assert.equal(await page.getByRole('button', { name: 'Publish current grades' }).isDisabled(), true);
    await page.getByText('Save grading before publishing changes.', { exact: true }).waitFor();
    await page.getByLabel('Required work points', { exact: true }).fill('100');
    assert.equal(await page.getByRole('button', { name: 'Publish current grades' }).isDisabled(), false);
    await page.getByRole('button', { name: 'Publish current grades' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await page.evaluate(() => window.gradeCalls.find(call => call[0] === 'publish')), ['publish', 'a', 0, 'teacher-a']);
    assert.match(await table.locator('tbody tr').first().textContent(), /105 \/ 100.*Published/);
    assert.doesNotMatch(await table.locator('tbody tr').first().textContent(), /Published 100 \/ 100/);
    // Different completed activities still require a publication even when totals match.
    await page.evaluate(() => {
        const grade = window.gradeData.students[1].grades[0]; grade.activities[0].complete = false; grade.activities[0].points = 0; grade.activities[1].complete = true; grade.activities[1].points = 50;
    });
    await page.getByLabel('Grade period', { exact: true }).selectOption('custom');
    const benCell = table.getByRole('button', { name: 'Ben Torres, Digital citizenship: 50 of 100 points', exact: true });
    await benCell.getByText(/Live changes/).waitFor();
    await page.evaluate(() => {
        const grade = window.gradeData.students[1].grades[0]; grade.activities[0].complete = true; grade.activities[0].points = 50; grade.activities[1].complete = false; grade.activities[1].points = 0;
    });
    await page.getByLabel('Grade period', { exact: true }).selectOption('3');
    await table.getByRole('button', { name: 'Ben Torres, Digital citizenship: 50 of 100 points', exact: true }).getByText('Published', { exact: true }).waitFor();
    // Disabling live grading does not silently remove an already published result.
    await table.getByRole('button', { name: 'Grading settings for Digital citizenship', exact: true }).click();
    await page.getByLabel('Grade this vocabulary', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save grading', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.match(await table.locator('tbody tr').first().textContent(), /Not graded.*Published 105 \/ 100.*Live changes/);
    await table.getByRole('button', { name: 'Grading settings for Digital citizenship', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Publish ungraded status', exact: true }).isDisabled(), false);
    await page.getByRole('button', { name: 'Publish ungraded status', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.gradeData.students[0].grades[0].published.enabled), false);
    // Restore a live configuration for the remaining checks; the snapshot stays separate.
    await page.evaluate(async () => {
        window.gradeData.assignments[0].grading.enabled = true;
        for (const student of window.gradeData.students) student.grades[0].enabled = true;
        await window.mountGradebook();
    });
    await table.getByRole('button', { name: 'Grading settings for Practice vocabulary', exact: true }).click();
    await page.getByLabel('Grade this vocabulary', { exact: true }).check();
    await page.getByLabel('Bonus points per additional activity', { exact: true }).fill('2.5');
    await page.evaluate(() => { window.failSave = true; });
    await page.getByRole('button', { name: 'Save grading', exact: true }).click();
    await page.getByText('Grading settings changed. Reload grades.', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Bonus points per additional activity', { exact: true }).inputValue(), '2.5');
    await page.evaluate(() => { window.failSave = false; });
    await page.getByRole('button', { name: 'Save grading', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    const savedCall = await page.evaluate(() => window.gradeCalls.filter(call => call[0] === 'save').at(-1));
    assert.equal(savedCall[2].enabled, true); assert.equal(savedCall[2].bonusPerActivity, 2.5); assert.equal(savedCall[4], 'teacher-a');
    await page.getByLabel('Grade period', { exact: true }).selectOption('custom');
    await page.getByLabel('Assigned from', { exact: true }).fill('2026-10-01'); await page.getByLabel('Assigned through', { exact: true }).fill('2026-10-15');
    await page.getByRole('button', { name: 'Apply dates', exact: true }).click(); await page.getByText(/Assigned between 2026-10-01 and 2026-10-15/).waitFor();
    await page.getByLabel('Search grade students').fill('Ana');
    await table.getByRole('button', { name: 'Ana Rivera', exact: true }).click();
    assert.equal(await page.evaluate(() => window.openedGradeStudent.gradebookContext.from), '2026-10-01');
    await page.getByLabel('Search grade students').fill('');
    await page.evaluate(() => { window.holdGrades = true; });
    await page.getByLabel('Grade period', { exact: true }).selectOption('3'); await page.waitForFunction(() => Boolean(window.resolveOldGrades));
    await page.getByLabel('Grade period', { exact: true }).selectOption('custom'); await table.waitFor();
    await page.evaluate(() => window.resolveOldGrades({ assignments: [], students: [] }));
    assert.equal(await table.locator('tbody tr').count(), 2);
    await page.evaluate(async () => {
        const { assignments, students } = window.gradeData;
        assignments[1].grading.enabled = false;
        for (const student of students) student.grades[1].enabled = false;
        const result = students[0].grades[0], saved = structuredClone(result); delete saved.published;
        saved.bonusPoints = 0; saved.earnedPoints = 100; saved.percent = 100; saved.additionalCompleted = 0;
        saved.activities[2].complete = false; saved.activities[2].points = 0; saved.publishedAt = '2026-10-02T12:00Z'; result.published = saved;
        await window.mountGradebook();
        await document.fonts.ready; window.scrollTo(0, 0); document.activeElement?.blur();
    });
    await page.screenshot({ path: '/tmp/sparks-vocabulary-grades-desktop.png', fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Grade student', { exact: true }).selectOption('1');
    assert.equal(await page.evaluate(() => window.gradeState.studentId), '1');
    assert.match(await page.locator('.vocabulary-gradebook-mobile').textContent(), /Ben Torres.*Digital citizenship.*50 \/ 100/s);
    const mobileTitle = page.locator('.vocabulary-gradebook-mobile .vocabulary-grade-mobile-row .vocabulary-grade-assignment').first();
    const titleBox = await mobileTitle.boundingBox();
    assert.ok(titleBox.width >= 200, 'mobile titles keep the full row width rather than sharing it with publication captions');
    assert.ok(titleBox.height <= 48, 'a normal vocabulary title must not split into fragments');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: '/tmp/sparks-vocabulary-grades-mobile.png', fullPage: true, animations: 'disabled' });
    await page.getByLabel('Grade period', { exact: true }).selectOption('custom');
    await page.evaluate(() => { window.failGrades = true; });
    await page.getByRole('button', { name: 'Apply dates', exact: true }).click(); await page.getByRole('button', { name: 'Retry grades', exact: true }).waitFor();
    assert.equal(await page.getByRole('table', { name: 'Class vocabulary grades' }).count(), 0);
    await page.evaluate(() => { window.failGrades = false; }); await page.getByRole('button', { name: 'Retry grades', exact: true }).click();
    await page.getByLabel('Grade student', { exact: true }).waitFor();
    await page.evaluate(() => { window.gradeController.abort(); window.gradeCurrent = false; });
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Teacher vocabulary gradebook checks passed: live/published separation, weighted totals, points settings, principal capture, dirty-form publish guard, conflicts, dates, navigation, mobile, stale requests and read retry.');
} finally { await browser?.close(); server?.kill(); }
