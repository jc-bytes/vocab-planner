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

    const navigationRace = await page.evaluate(async () => {
        document.body.innerHTML = `
            <section id="teacher-dashboard-view" class="view active"></section>
            <section id="vocabulary-quizzes-panel"></section>
            <div data-teacher-feature-mount="quizzes-view"></div>
            <template id="teacher-quizzes-view-template">
                <section id="teacher-quizzes-view"><div id="quiz-vocab-picker"></div></section>
            </template>
        `;
        const { installTeacherLazyFeatureMethods } = await import(
            `/js/teacherLazyFeatures.js?quiz-navigation-race=${Date.now()}`
        );
        const { installTeacherRoutingMethods } = await import('/js/teacherRouting.js');
        const { teacherVocabularyWorkflowMethods } = await import(
            '/js/teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js'
        );
        const { QUIZ_VOCABULARY_BROWSER_CAPABILITIES } = await import('/js/teacherQuizVocabularyBrowserAdapter.js');
        class Manager {
            constructor() {
                this.currentUser = { id: 'teacher-navigation' };
                this.isAuthenticated = true;
                this.isApplyingRoute = false;
                this.pendingTeacherRoute = null;
                this.pendingTeacherNavigation = null;
                this.teacherNavigationGeneration = 0;
                this.vocabularyMode = 'assign';
                this.vocabSet = { id: 'unit', subjectSlug: 'technology', words: [{ word: 'term', definition: 'meaning' }] };
                this.libraryItems = [];
                this.libraryDrilldown = { subject: null, grade: null, trimester: null, month: null };
                this.activations = 0;
                this.libraryRequests = 0;
            }

            ensureAuthenticated() { return true; }
            switchView() { this.activations += 1; }
            async getTeacherLibrary() { this.libraryRequests += 1; return { items: [] }; }
            getSubjects() { return []; }
            refreshIcons() {}
            updateFormUI() {}
            renderWords() {}
        }
        QUIZ_VOCABULARY_BROWSER_CAPABILITIES.forEach(name => { Manager.prototype[name] = () => []; });
        Manager.prototype.setVocabularyWorkflowTab = teacherVocabularyWorkflowMethods.setVocabularyWorkflowTab;
        installTeacherLazyFeatureMethods(Manager);
        installTeacherRoutingMethods(Manager);
        const manager = new Manager();
        history.replaceState(null, '', '#/teacher/vocabulary');
        manager.setVocabularyWorkflowTab('quizzes');
        manager.setVocabularyWorkflowTab('review', { loadReview: false });
        await new Promise(resolve => setTimeout(resolve, 50));
        const staleResult = {
            hash: window.location.hash,
            mode: manager.vocabularyMode,
            activations: manager.activations,
            libraryRequests: manager.libraryRequests,
            generation: manager.teacherNavigationGeneration
        };
        manager.libraryDrilldown = { subject: 'science', grade: '9', trimester: null, month: null };
        history.replaceState(null, '', '#/teacher/vocabulary');
        const historyBeforeQuiz = history.length;
        manager.setVocabularyWorkflowTab('quizzes');
        await new Promise(resolve => setTimeout(resolve, 50));
        const normalResult = {
            hash: window.location.hash,
            historyDelta: history.length - historyBeforeQuiz,
            activations: manager.activations,
            libraryRequests: manager.libraryRequests
        };
        history.replaceState(
            null,
            '',
            '#/teacher/vocabulary?subject=technology&grade=8&trimester=2&month=August&mode=quizzes'
        );
        manager.libraryDrilldown = {
            subject: 'technology',
            grade: '8',
            trimester: '2',
            month: 'August'
        };
        const historyBeforeRepeatedQuiz = history.length;
        manager.setVocabularyWorkflowTab('quizzes', {
            drilldown: {
                subject: 'technology',
                grade: '8',
                trimester: '2',
                month: 'August'
            }
        });
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
            staleResult,
            normalResult,
            repeatedQuizResult: {
                hash: window.location.hash,
                historyDelta: history.length - historyBeforeRepeatedQuiz
            }
        };
    });
    if (navigationRace.staleResult.hash !== '#/teacher/vocabulary?mode=review'
        || navigationRace.staleResult.mode !== 'review'
        || navigationRace.staleResult.activations !== 0
        || navigationRace.staleResult.libraryRequests !== 0
        || navigationRace.staleResult.generation !== 2
        || navigationRace.normalResult.hash !== '#/teacher/vocabulary?mode=quizzes'
        || navigationRace.normalResult.historyDelta !== 1
        || navigationRace.normalResult.activations !== 1
        || navigationRace.normalResult.libraryRequests !== 1
        || navigationRace.repeatedQuizResult.hash !== '#/teacher/vocabulary?subject=technology&grade=8&trimester=2&month=August&mode=quizzes'
        || navigationRace.repeatedQuizResult.historyDelta !== 0) {
        throw new Error(`A stale Quiz import replaced newer Vocabulary navigation: ${JSON.stringify(navigationRace)}`);
    }

    const reorderPage = await browser.newPage();
    reorderPage.on('console', message => {
        if (message.type() === 'error') problems.push(`reorder console.error: ${message.text()}`);
    });
    reorderPage.on('pageerror', error => problems.push(`reorder pageerror: ${error.message}`));
    await reorderPage.goto(`${baseUrl}/teacher.html`, { waitUntil: 'networkidle' });
    const reorderSetup = await reorderPage.evaluate(async () => {
        document.body.innerHTML = `
            <main id="quiz-reorder-smoke">
                <button id="quiz-maker-back-btn"></button>
                <button id="quiz-maker-close-btn"></button>
                <button id="quiz-maker-word-btn"></button>
                <button id="add-quiz-section-btn"></button>
                <button id="generate-questions-btn"></button>
                <button id="edit-rubric-btn"></button>
                <input id="quiz-title-input">
                <textarea id="quiz-instructions-input"></textarea>
                <input id="quiz-school-input">
                <input id="quiz-teacher-input">
                <input id="quiz-grade-input">
                <input id="quiz-border-toggle" type="checkbox">
                <select id="quiz-font-select"><option value="Arial, sans-serif">Arial</option></select>
                <div id="quiz-section-list"></div>
                <div style="width: 1100px"><div id="quiz-questions-list"></div></div>
            </main>
        `;
        const { QuizMaker } = await import(`/js/quizMaker.js?reorder-smoke=${Date.now()}`);
        const questions = Array.from({ length: 24 }, (_, index) => ({
            id: `question-${index}`,
            type: 'short',
            points: 1,
            prompt: `Explain term ${index}.`,
            answer: `Answer ${index}.`
        }));
        const maker = new QuizMaker(
            { name: 'Reorder smoke', grade: '6', words: [{ word: 'term', definition: 'meaning' }] },
            () => {},
            { state: { quizSections: [], questions } }
        );
        window.quizReorderSmoke = maker;
        return {
            order: maker.questions.map(question => question.id),
            pages: document.querySelectorAll('#quiz-questions-list .document-page').length,
            sortables: maker.questionSortables.length
        };
    });
    if (reorderSetup.pages < 2 || reorderSetup.sortables !== reorderSetup.pages) {
        throw new Error(`Quiz reorder did not cover every preview page: ${JSON.stringify(reorderSetup)}`);
    }

    await reorderPage.locator('.doc-q-card').nth(1).locator('.quiz-question-move-up').click();
    const buttonReorder = await reorderPage.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.doc-q-card'));
        return {
            order: window.quizReorderSmoke.questions.map(question => question.id),
            focusLabel: document.activeElement?.getAttribute('aria-label'),
            firstUpDisabled: cards[0]?.querySelector('.quiz-question-move-up')?.disabled,
            lastDownDisabled: cards.at(-1)?.querySelector('.quiz-question-move-down')?.disabled
        };
    });
    if (buttonReorder.order[0] !== 'question-1'
        || buttonReorder.order[1] !== 'question-0'
        || buttonReorder.focusLabel !== 'Move question 1 down'
        || buttonReorder.firstUpDisabled !== true
        || buttonReorder.lastDownDisabled !== true) {
        throw new Error(`Quiz button reorder or focus restoration changed: ${JSON.stringify(buttonReorder)}`);
    }

    const crossPageReorder = await reorderPage.evaluate(() => {
        const container = document.querySelector('#quiz-questions-list');
        const pages = Array.from(container.querySelectorAll('.document-page'));
        const firstCard = container.querySelector('.doc-q-card');
        const lastPageCard = pages.at(-1)?.querySelector('.doc-q-card');
        pages.at(-1)?.insertBefore(firstCard, lastPageCard || null);
        const movedId = window.quizReorderSmoke.questions[Number.parseInt(firstCard.dataset.index, 10)]?.id;
        window.quizReorderSmoke.questionSortables.at(-1).options.onEnd();
        return {
            movedId,
            order: window.quizReorderSmoke.questions.map(question => question.id),
            pages: document.querySelectorAll('#quiz-questions-list .document-page').length,
            sortables: window.quizReorderSmoke.questionSortables.length
        };
    });
    if (crossPageReorder.order.at(-1) === crossPageReorder.movedId
        || crossPageReorder.order.indexOf(crossPageReorder.movedId) < 1
        || crossPageReorder.order.length !== 24
        || new Set(crossPageReorder.order).size !== 24
        || crossPageReorder.pages < 2
        || crossPageReorder.sortables !== crossPageReorder.pages) {
        throw new Error(`Quiz data order across preview page containers changed: ${JSON.stringify(crossPageReorder)}`);
    }

    const reorderTeardown = await reorderPage.evaluate(() => {
        window.quizReorderSmoke.destroy();
        return {
            disposed: window.quizReorderSmoke.disposed,
            sortables: window.quizReorderSmoke.questionSortables.length
        };
    });
    if (!reorderTeardown.disposed || reorderTeardown.sortables !== 0) {
        throw new Error(`Quiz reorder teardown changed: ${JSON.stringify(reorderTeardown)}`);
    }
    await reorderPage.close();
    if (problems.length) throw new Error(problems.join('\n'));
    console.log('Teacher Quiz lazy-feature smoke passed.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
