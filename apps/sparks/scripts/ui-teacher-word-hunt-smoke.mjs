import process from 'node:process';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_TEACHER_WORD_HUNT_HOST || '127.0.0.1';
const port = Number(process.env.UI_TEACHER_WORD_HUNT_PORT || 8000);
const baseUrl = (process.env.UI_TEACHER_WORD_HUNT_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');

let server;
let browser;
const problems = [];

try {
    server = await ensureViteServer({
        baseUrl,
        probePath: '/',
        host,
        port,
        external: Boolean(process.env.UI_TEACHER_WORD_HUNT_BASE_URL)
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
            <section id="vocabulary-review-panel">
                <div id="word-hunt-review-content"></div>
            </section>
        `;
        const { supabaseService } = await import('/js/supabaseService.js');
        let requests = 0;
        supabaseService.getWordHuntReviewData = async () => {
            requests += 1;
            return [{
                id: 'student-one',
                email: 'student@example.test',
                studentProfile: { firstName: 'Ada', lastName: 'Lovelace', grade: '6', group: 'A' },
                units: {
                    'technology:unit_one': {
                        wordHunt: {
                            Algorithm: {
                                definition: 'A precise sequence of steps used to solve a problem.',
                                exampleOne: 'Ada followed an algorithm to sort the cards.',
                                exampleTwo: 'The robot repeats the algorithm.',
                                imagePath: 'student-one/algorithm.webp'
                            }
                        }
                    }
                }
            }];
        };
        supabaseService.downloadWordHuntImage = async () => new Blob(['image'], { type: 'image/webp' });
        const originalRevoke = URL.revokeObjectURL.bind(URL);
        const lifecycle = { revoked: 0 };
        URL.revokeObjectURL = url => {
            lifecycle.revoked += 1;
            originalRevoke(url);
        };
        const { installTeacherLazyFeatureMethods } = await import(
            `/js/teacherLazyFeatures.js?word-hunt-lazy-smoke=${Date.now()}`
        );

        class Manager {
            constructor() {
                this.authDisabled = false;
                this.vocabularyMode = 'assign';
                this.currentView = '';
                this.workflowCalls = [];
            }

            ensureAuthenticated() { return true; }
            switchView(viewId) { this.currentView = viewId; }
            setVocabularyWorkflowTab(tab, options) { this.workflowCalls.push({ tab, options }); }
            getSubjects() { return []; }
            refreshIcons() {}
        }

        installTeacherLazyFeatureMethods(Manager);
        const manager = new Manager();
        await manager.loadWordHuntReview();
        await manager.loadWordHuntReview();
        await manager.showWordHuntReviewView({ updateRoute: false, replace: true });
        window.wordHuntSmoke = { manager, getRequests: () => requests, lifecycle };

        return {
            requests,
            currentView: manager.currentView,
            vocabularyMode: manager.vocabularyMode,
            workflowCalls: manager.workflowCalls,
            internalMethod: typeof manager.buildWordHuntReviewRows,
            internalState: Object.keys(manager).filter(key => key.startsWith('wordHuntReview'))
        };
    });

    if (result.requests !== 1) throw new Error(`Expected one cached review request, got ${result.requests}.`);
    if (result.currentView !== 'teacher-dashboard-view' || result.vocabularyMode !== 'review') {
        throw new Error(`Review activation changed: ${JSON.stringify(result)}`);
    }
    if (result.workflowCalls.length !== 1
        || result.workflowCalls[0].tab !== 'review'
        || result.workflowCalls[0].options.loadReview !== false
        || result.workflowCalls[0].options.updateRoute !== false
        || result.workflowCalls[0].options.replace !== true) {
        throw new Error(`Workflow activation changed: ${JSON.stringify(result.workflowCalls)}`);
    }
    if (result.internalMethod !== 'undefined' || result.internalState.length) {
        throw new Error(`Word Hunt internals leaked to manager: ${JSON.stringify(result)}`);
    }
    for (const action of ['subject', 'grade', 'group', 'unit']) {
        await page.locator(`[data-word-hunt-review-action="${action}"]`).first().click();
    }
    await page.locator('.word-hunt-image-review img').waitFor();
    const disposal = await page.evaluate(async () => {
        const { manager, getRequests, lifecycle } = window.wordHuntSmoke;
        manager.disposeLoadedTeacherFeatures();
        const revokedAfterDispose = lifecycle.revoked;
        await manager.loadWordHuntReview();
        return {
            revokedAfterDispose,
            requestsAfterReload: getRequests(),
            internalState: Object.keys(manager).filter(key => key.startsWith('wordHuntReview'))
        };
    });
    if (disposal.revokedAfterDispose !== 1 || disposal.requestsAfterReload !== 2) {
        throw new Error(`Feature disposal did not release URLs and clear cached data: ${JSON.stringify(disposal)}`);
    }
    if (disposal.internalState.length) {
        throw new Error(`Word Hunt state leaked after disposal: ${JSON.stringify(disposal.internalState)}`);
    }
    if (problems.length) throw new Error(problems.join('\n'));
    console.log('Teacher Word Hunt lazy-feature smoke passed.');
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
