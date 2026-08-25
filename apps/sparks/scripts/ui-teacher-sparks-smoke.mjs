import process from 'node:process';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_TEACHER_SPARKS_HOST || '127.0.0.1';
const port = Number(process.env.UI_TEACHER_SPARKS_PORT || 8000);
const baseUrl = (process.env.UI_TEACHER_SPARKS_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');

let server;
let browser;
const problems = [];

try {
    server = await ensureViteServer({
        baseUrl,
        probePath: '/',
        host,
        port,
        external: Boolean(process.env.UI_TEACHER_SPARKS_BASE_URL)
    });
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', message => {
        if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const initial = await page.evaluate(async () => {
        document.body.innerHTML = `
            <section id="teacher-sparks-view"><button id="add-spark-btn">Add Spark</button><div id="spark-library-list"></div></section>
            <div data-teacher-feature-mount="sparks-modal"></div>
            <template id="teacher-sparks-modal-template">
                <div id="spark-modal" class="modal hidden">
                    <div class="modal-content">
                        <div class="modal-header"><h2 id="spark-modal-title">Add Spark</h2><button class="close-modal" type="button">Close</button></div>
                        <form id="spark-form">
                            <input id="spark-id"><select id="spark-type"><option value="cool_fact">Cool fact</option></select>
                            <input id="spark-title-input"><textarea id="spark-text-input"></textarea><textarea id="spark-why-input"></textarea>
                            <select id="spark-check-mode-input"><option value="reading_only">Reading only</option><option value="optional">Optional</option></select>
                            <textarea id="spark-question-input"></textarea>
                            ${[6, 7, 8, 9].map(grade => `<input id="spark-grade-question-${grade}-input"><input id="spark-target-grade-${grade}-input" type="checkbox" value="${grade}">`).join('')}
                            <input id="spark-source-title-input"><input id="spark-source-url-input"><input id="spark-scheduled-date-input" type="date">
                            <input id="spark-status-input" value="draft">
                            <div id="spark-question-builder-group"><div id="spark-question-builder"></div><button id="add-spark-question-btn" type="button">Add question</button></div>
                            <div id="spark-modal-status"></div>
                            <button id="save-spark-draft-btn" type="button">Save draft</button>
                            <button id="schedule-spark-btn" type="button">Schedule</button>
                        </form>
                    </div>
                </div>
            </template>
        `;
        const { sparksRepository } = await import('/js/services/sparksRepository.js');
        const rows = [];
        let listCalls = 0;
        let saveCalls = 0;
        sparksRepository.list = async () => {
            listCalls += 1;
            return rows.map(row => ({ ...row }));
        };
        sparksRepository.save = async (id, spark) => {
            saveCalls += 1;
            const index = rows.findIndex(row => row.id === id);
            const saved = { ...spark, id };
            if (index >= 0) rows[index] = saved;
            else rows.push(saved);
            return saved;
        };
        const { installTeacherLazyFeatureMethods } = await import(`/js/teacherLazyFeatures.js?sparks-lazy-smoke=${Date.now()}`);

        class Manager {
            constructor() {
                this.authDisabled = false;
                this.currentUser = { uid: 'teacher-smoke' };
                this.currentView = '';
            }

            ensureAuthenticated() { return true; }
            switchView(viewId) { this.currentView = viewId; }
            refreshIcons() {}
        }

        installTeacherLazyFeatureMethods(Manager);
        const manager = new Manager();
        const modalBefore = document.querySelector('#spark-modal');
        await manager.showSparksView();
        window.teacherSparksSmoke = {
            manager,
            counts: () => ({ listCalls, saveCalls }),
            rows
        };
        return {
            modalBefore: Boolean(modalBefore),
            modalAfter: Boolean(document.querySelector('#spark-modal')),
            modalReady: document.querySelector('#spark-modal')?.dataset.modalReady,
            currentView: manager.currentView,
            listCalls,
            internalMethod: typeof manager.openSparkModal,
            internalState: Object.keys(manager).filter(key => key.startsWith('weeklySpark') || key.startsWith('sparkModal'))
        };
    });

    if (initial.modalBefore || !initial.modalAfter || initial.modalReady !== 'true') {
        throw new Error(`Spark modal lazy mounting changed: ${JSON.stringify(initial)}`);
    }
    if (initial.currentView !== 'teacher-sparks-view' || initial.listCalls !== 1) {
        throw new Error(`Spark view activation changed: ${JSON.stringify(initial)}`);
    }
    if (initial.internalMethod !== 'undefined' || initial.internalState.length) {
        throw new Error(`Spark internals leaked to manager: ${JSON.stringify(initial)}`);
    }

    await page.locator('#add-spark-btn').click();
    await page.locator('#spark-title-input').fill('Architecture smoke Spark');
    await page.locator('#spark-text-input').fill('This verifies the explicit lazy feature workflow.');
    await page.locator('#spark-check-mode-input').selectOption('reading_only');
    await page.locator('#spark-target-grade-6-input').check();
    await page.locator('#save-spark-draft-btn').click();
    await page.waitForFunction(() => window.teacherSparksSmoke.counts().saveCalls === 1);
    await page.locator('#spark-modal').waitFor({ state: 'hidden' });

    const disposal = await page.evaluate(async () => {
        const { manager, counts } = window.teacherSparksSmoke;
        manager.disposeLoadedTeacherFeatures();
        await manager.showSparksView();
        return {
            ...counts(),
            internalState: Object.keys(manager).filter(key => key.startsWith('weeklySpark') || key.startsWith('sparkModal'))
        };
    });
    if (disposal.listCalls !== 3 || disposal.saveCalls !== 1 || disposal.internalState.length) {
        throw new Error(`Spark disposal/reload changed: ${JSON.stringify(disposal)}`);
    }

    await page.locator('#add-spark-btn').click();
    await page.locator('#spark-title-input').fill('Second smoke Spark');
    await page.locator('#spark-text-input').fill('This proves listeners bind once after recreation.');
    await page.locator('#spark-check-mode-input').selectOption('reading_only');
    await page.locator('#spark-target-grade-6-input').check();
    await page.locator('#save-spark-draft-btn').click();
    await page.waitForFunction(() => window.teacherSparksSmoke.counts().saveCalls === 2);
    await page.waitForTimeout(50);
    const finalCounts = await page.evaluate(() => window.teacherSparksSmoke.counts());
    if (finalCounts.saveCalls !== 2) {
        throw new Error(`Spark listeners duplicated after recreation: ${JSON.stringify(finalCounts)}`);
    }
    if (problems.length) throw new Error(problems.join('\n'));
    console.log('Teacher Sparks lazy-feature smoke passed.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
