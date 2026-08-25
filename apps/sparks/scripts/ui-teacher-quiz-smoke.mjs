import process from 'node:process';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_TEACHER_QUIZ_HOST || '127.0.0.1';
const port = Number(process.env.UI_TEACHER_QUIZ_PORT || 8000);
const baseUrl = (process.env.UI_TEACHER_QUIZ_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');

let server;
let browser;
const problems = [];

try {
    server = await ensureViteServer({
        baseUrl,
        probePath: '/',
        host,
        port,
        external: Boolean(process.env.UI_TEACHER_QUIZ_BASE_URL)
    });
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', message => {
        if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
    });
    page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
        document.body.innerHTML = `
            <section id="vocabulary-quizzes-panel">
                <strong id="quiz-active-vocab-name"></strong>
                <span id="quiz-active-vocab-meta"></span>
                <div data-teacher-feature-mount="quizzes-view"></div>
            </section>
            <template id="teacher-quizzes-view-template">
                <section id="teacher-quizzes-view">
                    <div id="quiz-vocab-picker"></div>
                </section>
            </template>
        `;
        const { installTeacherLazyFeatureMethods } = await import(
            `/js/teacherLazyFeatures.js?quiz-lazy-smoke=${Date.now()}`
        );
        const { QUIZ_VOCABULARY_BROWSER_CAPABILITIES } = await import('/js/teacherQuizVocabularyBrowserAdapter.js');
        let libraryRequests = 0;
        class Manager {
            constructor() {
                this.vocabularyMode = 'assign';
                this.vocabSet = { id: '', subjectSlug: 'technology', words: [] };
                this.libraryItems = [{ vocab: { id: 'assign-only' } }];
                this.libraryDrilldown = { subject: 'science' };
                this.routeCalls = [];
            }

            ensureAuthenticated() { return true; }
            switchView(viewId, options) { this.currentView = viewId; this.viewOptions = options; }
            setVocabularyWorkflowTab(tab, options) { this.workflowCall = { tab, options }; }
            setRoute(route, options) { this.routeCalls.push({ route, options }); }
            async getTeacherLibrary() { libraryRequests += 1; return { items: [] }; }
            getSubjects() { return []; }
            refreshIcons() {}
            updateFormUI() {}
            renderWords() {}
        }
        QUIZ_VOCABULARY_BROWSER_CAPABILITIES.forEach(name => { Manager.prototype[name] = () => []; });

        installTeacherLazyFeatureMethods(Manager);
        const manager = new Manager();
        await manager.showQuizzesView({
            drilldown: { subject: 'technology', grade: '6', trimester: '1', month: 'March' },
            replaceRoute: true
        });
        const firstPicker = document.querySelector('#quiz-vocab-picker');
        const first = {
            mounted: Boolean(firstPicker),
            empty: firstPicker?.textContent.includes('No vocabulary sets are available yet.'),
            requests: libraryRequests,
            mode: manager.vocabularyMode,
            route: manager.routeCalls.at(-1),
            assignStatePreserved: manager.libraryItems[0]?.vocab?.id === 'assign-only'
                && manager.libraryDrilldown.subject === 'science',
            leakedState: Object.keys(manager).filter(key => /^quiz(?:Library|Drilldown|Maker|Editor|Return)/.test(key)),
            leakedMethod: typeof manager.loadQuizPicker
        };

        manager.disposeLoadedTeacherFeatures();
        const clearedAfterDispose = firstPicker.childNodes.length === 0;
        await manager.showQuizzesView({ updateRoute: false });
        return {
            ...first,
            clearedAfterDispose,
            requestsAfterReload: libraryRequests,
            leakedStateAfterReload: Object.keys(manager).filter(key => /^quiz(?:Library|Drilldown|Maker|Editor|Return)/.test(key))
        };
    });

    if (!result.mounted || !result.empty || result.requests !== 1) {
        throw new Error(`Quiz picker lazy mounting changed: ${JSON.stringify(result)}`);
    }
    if (result.mode !== 'quizzes' || result.route?.route?.mode !== 'quizzes' || result.route?.options?.replace !== true) {
        throw new Error(`Quiz activation or routing changed: ${JSON.stringify(result)}`);
    }
    if (!result.assignStatePreserved || result.leakedMethod !== 'undefined' || result.leakedState.length) {
        throw new Error(`Quiz ownership leaked into TeacherManager: ${JSON.stringify(result)}`);
    }
    if (!result.clearedAfterDispose || result.requestsAfterReload !== 2 || result.leakedStateAfterReload.length) {
        throw new Error(`Quiz disposal/recreation changed: ${JSON.stringify(result)}`);
    }
    if (problems.length) throw new Error(problems.join('\n'));
    console.log('Teacher Quiz lazy-feature smoke passed.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
