import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const port = 8164, baseUrl = `http://127.0.0.1:${port}`;
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port });
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    await page.goto(baseUrl);
    await page.evaluate(async () => {
        const template = new DOMParser().parseFromString(await fetch('/teacher.html').then(r => r.text()), 'text/html');
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(item => item.remove());
        const styles = [...template.querySelectorAll('link[rel="stylesheet"]')].map(link => {
            const copy = link.cloneNode(true); const loaded = new Promise(resolve => { copy.onload = resolve; copy.onerror = resolve; }); document.head.append(copy); return loaded;
        });
        document.body.className = 'teacher-site';
        document.body.innerHTML = '<div class="app-container"><main class="teacher-main"><section class="view active"><div class="vocab-editor-config-grid"><section class="vocab-editor-panel vocab-config-activities-panel"><h3>Activities</h3><div id="activity-preset-controls"></div></section></div></section></main></div>';
        await Promise.all(styles);
        const { renderVocabularyGradingSettings } = await import('/js/teacherVocabularyGradingSettings.js');
        window.gradeSettingsManager = { vocabSet: { activitySettings: {} }, currentUser: { uid: 'teacher' }, teacherVocabularyDocumentGeneration: 1,
            saves: 0, triggerAutoSave() { this.saves++; } };
        window.renderGradeSettings = () => renderVocabularyGradingSettings(window.gradeSettingsManager);
        window.renderGradeSettings();
    });
    assert.equal(await page.getByLabel('Grade this vocabulary', { exact: true }).isChecked(), false);
    assert.equal(await page.getByLabel('Base points', { exact: true }).isDisabled(), true);
    await page.getByLabel('Grade this vocabulary', { exact: true }).check();
    await page.getByLabel('Base points', { exact: true }).fill('50');
    await page.getByLabel('Extra points per additional activity', { exact: true }).fill('2.5');
    await page.getByLabel('Maximum extra points', { exact: true }).fill('10');
    assert.deepEqual(await page.evaluate(() => window.gradeSettingsManager.vocabSet.activitySettings.grading), {
        enabled: true, maxPoints: 50, bonusPerActivity: 2.5, bonusCap: 10, capAtMaxPoints: false
    });
    const saves = await page.evaluate(() => window.gradeSettingsManager.saves);
    await page.getByLabel('Base points', { exact: true }).fill('0');
    assert.equal(await page.evaluate(() => window.gradeSettingsManager.saves), saves);
    assert.equal(await page.evaluate(() => window.gradeSettingsManager.vocabSet.activitySettings.grading.maxPoints), 50);
    await page.getByLabel('Base points', { exact: true }).fill('50');
    await page.getByLabel('Maximum extra points', { exact: true }).fill('');
    assert.equal(await page.evaluate(() => window.gradeSettingsManager.vocabSet.activitySettings.grading.bonusCap), null);
    await page.getByLabel('Limit the final score to the base points', { exact: true }).check();
    await page.evaluate(() => window.renderGradeSettings());
    assert.equal(await page.getByLabel('Base points', { exact: true }).inputValue(), '50');
    assert.equal(await page.getByLabel('Limit the final score to the base points', { exact: true }).isChecked(), true);
    await page.locator('.vocab-editor-panel').screenshot({ path: '/tmp/sparks-vocabulary-grading-settings.png', animations: 'disabled' });
    await page.getByLabel('Grade this vocabulary', { exact: true }).uncheck();
    assert.equal(await page.evaluate(() => window.gradeSettingsManager.vocabSet.activitySettings.grading.enabled), false);
    // Detached controls cannot alter a different vocabulary draft.
    const guarded = await page.evaluate(() => {
        const old = document.querySelector('.vocabulary-grading-toggle input');
        window.gradeSettingsManager.vocabSet = { activitySettings: {} };
        old.checked = true; old.dispatchEvent(new Event('change'));
        return window.gradeSettingsManager.vocabSet.activitySettings.grading;
    }); assert.equal(guarded, undefined);

    await page.evaluate(async () => {
        const template = new DOMParser().parseFromString(await fetch('/student.html').then(r => r.text()), 'text/html');
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(item => item.remove());
        const styles = [...template.querySelectorAll('link[rel="stylesheet"]')].map(link => {
            const copy = link.cloneNode(true); const loaded = new Promise(resolve => { copy.onload = resolve; copy.onerror = resolve; }); document.head.append(copy); return loaded;
        });
        document.body.className = 'student-site';
        document.body.innerHTML = '<div class="app-container"><main class="student-main"></main></div>';
        const unit = template.querySelector('#activity-menu-view').cloneNode(true);
        unit.className = 'view active'; document.querySelector('main').append(unit);
        unit.querySelector('#current-unit-title').textContent = 'Online safety';
        await import('/js/student/studentUnitMenuStyles.js');
        await Promise.all(styles);
        const { mountStudentVocabularyGradePanel } = await import('/js/student/studentVocabularyGradePanel.js');
        window.gradePanelResponse = { grades: [] }; window.gradePanelReads = 0; window.gradePanelCurrent = true;
        window.mountGradePanel = () => {
            window.gradePanel?.dispose();
            window.gradePanel = mountStudentVocabularyGradePanel({ root: document.querySelector('main'), assignmentId: 'assignment-a', classId: 'class-a',
                isCurrent: () => window.gradePanelCurrent,
                repository: { myVocabularyGrades: async () => {
                    window.gradePanelReads++;
                    if (window.gradePanelFailure) throw new Error('Fixture read failure');
                    if (window.gradePanelHold) return new Promise(resolve => { window.gradePanelRelease = resolve; });
                    return window.gradePanelResponse;
                } } });
        };
        window.mountGradePanel();
    });
    await page.waitForFunction(() => window.gradePanelReads === 1 && document.querySelector('.student-vocabulary-grade').hidden);
    await page.evaluate(() => {
        window.gradePanelResponse = { grades: [{ assignmentId: 'assignment-a', enabled: true, status: 'provisional', maxPoints: 50, earnedPoints: 52.5,
            basePoints: 50, bonusPoints: 2.5, percent: 105, publishedAt: '2026-11-04T10:00:00Z',
            activities: [{ activityType: 'flashcards', required: true, complete: true, points: 50 }, { activityType: 'matching', required: false, complete: true, points: 2.5 }] }] };
    });
    await page.evaluate(() => window.mountGradePanel());
    await page.getByText('52.5 / 50', { exact: true }).waitFor();
    assert.equal(await page.getByText('105%', { exact: true }).isVisible(), false);
    for (const width of [1100, 390]) {
        await page.setViewportSize({ width, height: 850 });
        const close = await page.locator('#back-to-vocab').boundingBox();
        const grade = await page.locator('.student-vocabulary-grade-score').boundingBox();
        assert.ok(grade.y >= close.y + close.height, 'grade sits below the close control');
        assert.ok(Math.abs(grade.x + grade.width / 2 - close.x - close.width / 2) < 2, 'grade is centered under close');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: `/tmp/sparks-compact-grade-${width}.png`, animations: 'disabled' });
    }
    await page.locator('.student-vocabulary-grade-score').click();
    await page.getByText('105%', { exact: true }).waitFor();
    await page.getByText('How this grade was earned', { exact: true }).click();
    assert.match(await page.locator('.student-vocabulary-grade').textContent(), /Flashcards.*Required.*Complete.*50 points/);
    await page.evaluate(() => { window.gradePanelFailure = true; });
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await page.getByRole('button', { name: 'Retry grade', exact: true }).waitFor();
    assert.equal(await page.getByText('0 / 50', { exact: true }).count(), 0);
    await page.evaluate(() => { window.gradePanelFailure = false; });
    await page.getByRole('button', { name: 'Retry grade', exact: true }).click();
    await page.getByText('52.5 / 50', { exact: true }).waitFor();
    await page.evaluate(() => {
        window.gradePanelResponse = { grades: [{ assignmentId: 'assignment-a', enabled: true, status: 'provisional', maxPoints: 100, earnedPoints: 100,
            basePoints: 100, bonusPoints: 0, rawBonusPoints: 5, bonusLimited: true, percent: 100, publishedAt: '2026-11-04T11:00:00Z',
            activities: [{ activityType: 'flashcards', required: true, complete: true, points: 100 }, { activityType: 'matching', required: false, complete: true, points: 5 }] }] };
    });
    await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
    await page.getByText('100 / 100', { exact: true }).waitFor();
    assert.equal(await page.getByText('Base 100 points · Extra 0 points', { exact: true }).count(), 1);
    await page.getByText('How this grade was earned', { exact: true }).click();
    await page.getByText('Activity points below are before point limits.', { exact: false }).waitFor();
    await page.locator('.student-vocabulary-grade').screenshot({ path: '/tmp/sparks-student-published-grade.png', animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => { window.gradePanelHold = true; window.mountGradePanel(); });
    await page.waitForFunction(() => Boolean(window.gradePanelRelease));
    await page.evaluate(() => { window.gradePanelCurrent = false; window.gradePanelRelease(window.gradePanelResponse); window.gradePanel.dispose(); });
    assert.equal(await page.locator('.student-vocabulary-grade').count(), 0);
    console.log('Vocabulary grading settings/student panel checks passed: opt-in, point validation, save preservation, draft guards, published-only points, bonus, breakdown, retry, stale reads and mobile.');
} finally { await browser?.close(); server?.kill(); }
