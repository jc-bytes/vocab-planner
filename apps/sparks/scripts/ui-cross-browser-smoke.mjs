import process from 'node:process';
import { firefox, webkit } from 'playwright';

import {
    AUDIT_PASSWORD,
    AUDIT_STUDENT_EMAIL,
    AUDIT_TEACHER_EMAIL,
    AUDIT_VOCABULARY_ID,
    seedLocalAuditData
} from './lib/local-supabase-audit.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_CROSS_BROWSER_HOST || '127.0.0.1';
const port = Number(process.env.UI_CROSS_BROWSER_PORT || 8125);
const baseUrl = (process.env.UI_CROSS_BROWSER_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');
const activityPath = `/student.html#/unit/${AUDIT_VOCABULARY_ID}/activity/flashcards`;
const sandboxGame = {
    id: 'trapdoor-trials',
    path: 'js/games/trapdoor-trials/index.html',
    scoreMessageType: 'trapdoor-trials-score'
};
const browserEngines = new Map([
    ['firefox', ['Firefox', firefox]],
    ['webkit', ['WebKit', webkit]]
]);
const selectedEngines = String(process.env.UI_CROSS_BROWSER_ENGINES || 'firefox,webkit')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

function trackPageProblems(page, label, problems, options = {}) {
    page.on('console', message => {
        if (message.type() === 'error') problems.push(`[${label}] console.error: ${message.text()}`);
    });
    page.on('pageerror', error => {
        const ignored = (options.ignoredPageErrors || []).some(pattern => pattern.test(error.message));
        if (!ignored) problems.push(`[${label}] pageerror: ${error.message}`);
    });
}

async function addLocalSupabaseOverride(context, browserConfig) {
    await context.addInitScript(config => {
        window.SUPABASE_CONFIG = {
            url: config.url,
            publishableKey: config.publishableKey
        };
    }, browserConfig);
}

async function login(page, { pagePath, form, email, password, ready, error }) {
    await page.goto(`${baseUrl}${pagePath}`, { waitUntil: 'domcontentloaded' });
    if (await page.locator(form.selector).isVisible().catch(() => false)) {
        await page.fill(form.email, email);
        await page.fill(form.password, password);
        await page.locator(`${form.selector} button[type="submit"]`).click();
    }
    await page.waitForFunction(({ readySelector, errorSelector }) => (
        document.querySelector(readySelector)
        || document.querySelector(errorSelector)?.textContent.trim()
    ), { readySelector: ready, errorSelector: error }, { timeout: 30000 });

    const errorText = await page.locator(error).textContent().catch(() => '');
    if (errorText?.trim()) throw new Error(`${pagePath} login failed: ${errorText.trim()}`);
}

async function verifyIndexedDb(page) {
    const result = await page.evaluate(async () => {
        const databaseName = `cross-browser-smoke-${Date.now()}`;
        const openRequest = indexedDB.open(databaseName, 1);
        const database = await new Promise((resolve, reject) => {
            openRequest.onupgradeneeded = () => openRequest.result.createObjectStore('checks');
            openRequest.onsuccess = () => resolve(openRequest.result);
            openRequest.onerror = () => reject(openRequest.error);
        });
        const transaction = database.transaction('checks', 'readwrite');
        transaction.objectStore('checks').put('ok', 'status');
        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });
        const readTransaction = database.transaction('checks');
        const readRequest = readTransaction.objectStore('checks').get('status');
        const value = await new Promise((resolve, reject) => {
            readRequest.onsuccess = () => resolve(readRequest.result);
            readRequest.onerror = () => reject(readRequest.error);
        });
        database.close();
        indexedDB.deleteDatabase(databaseName);
        return value;
    });
    if (result !== 'ok') throw new Error(`IndexedDB round trip returned ${String(result)}.`);
}

async function verifySandboxGame(page) {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
        document.body.innerHTML = '<main id="game-stage"><canvas id="game-canvas"></canvas></main>';
    });
    await page.evaluate(async game => {
        const { StudentGameHtmlLoader } = await import('/js/student/studentGameHtmlLoaderMethods.js');
        const loader = new StudentGameHtmlLoader({
            sm: {},
            currentGame: null,
            currentGameMetadata: null,
            currentGameScore: 0,
            lastSavedScore: 0,
            saveHighScore: async () => {}
        });
        await loader.loadHTMLGame(
            game.id,
            game.path,
            game.scoreMessageType,
            () => {},
            document.querySelector('#game-canvas'),
            document.querySelector('#game-stage')
        );
    }, sandboxGame);

    const iframe = page.locator(`#${sandboxGame.id}-iframe`);
    await iframe.waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForFunction(path => Array.from(document.querySelectorAll('iframe'))
        .some(element => decodeURI(element.src).includes(path)), sandboxGame.path);
    const isolation = await iframe.evaluate(element => ({
        sandbox: element.getAttribute('sandbox') || '',
        parentCannotReadDocument: element.contentDocument === null
    }));
    if (isolation.sandbox.includes('allow-same-origin') || !isolation.parentCannotReadDocument) {
        throw new Error('Sandboxed game can access the parent application origin.');
    }
}

async function runEngine(name, browserType, browserConfig) {
    console.log(`${name}: launching...`);
    const browser = await browserType.launch({ timeout: 20000 });
    const problems = [];
    try {
        const teacherContext = await browser.newContext();
        const studentContext = await browser.newContext();
        await addLocalSupabaseOverride(teacherContext, browserConfig);
        await addLocalSupabaseOverride(studentContext, browserConfig);

        const teacherPage = await teacherContext.newPage();
        const studentPage = await studentContext.newPage();
        // The audit unit belongs to August/T2; keep its release window stable.
        await studentPage.clock.setFixedTime(new Date('2026-08-24T15:00:00Z'));
        trackPageProblems(teacherPage, `${name}:teacher`, problems);
        trackPageProblems(studentPage, `${name}:student`, problems);

        console.log(`${name}: checking teacher authentication and navigation...`);
        await login(teacherPage, {
            pagePath: '/teacher.html',
            form: { selector: '#teacher-login-form', email: '#teacher-email', password: '#teacher-password' },
            email: AUDIT_TEACHER_EMAIL,
            password: AUDIT_PASSWORD,
            ready: '#teacher-tab-shell:not(.hidden)',
            error: '#teacher-login-error'
        });
        await teacherPage.locator('#tab-vocabulary').click();
        await teacherPage.locator('#teacher-dashboard-view:not(.hidden)').waitFor({ timeout: 15000 });
        await teacherPage.locator('#vocabulary-tab-quizzes').click();
        await teacherPage.locator('#vocabulary-quizzes-panel:not(.hidden)').waitFor({ timeout: 15000 });
        await teacherPage.waitForFunction(() => (
            getComputedStyle(document.querySelector('.quiz-tool-tabs')).display === 'grid'
        ), null, { timeout: 15000 });
        await teacherPage.locator('#tab-sparks').click();
        await teacherPage.locator('#teacher-sparks-view:not(.hidden)').waitFor({ timeout: 15000 });

        console.log(`${name}: checking student authentication and activity routing...`);
        await login(studentPage, {
            pagePath: '/student.html',
            form: { selector: '#student-login-form', email: '#login-email', password: '#login-password' },
            email: AUDIT_STUDENT_EMAIL,
            password: AUDIT_PASSWORD,
            ready: '#student-tab-shell:not(.hidden)',
            error: '#login-error'
        });
        await studentPage.goto(`${baseUrl}${activityPath}`, { waitUntil: 'domcontentloaded' });
        try {
            await studentPage.locator('#activity-view:not(.hidden)').waitFor({ timeout: 15000 });
        } catch (error) {
            const state = await studentPage.evaluate(() => ({
                hash: location.hash,
                activeView: document.querySelector('.view.active')?.id || '',
                loginError: document.querySelector('#login-error')?.textContent?.trim() || '',
                activityText: document.querySelector('#activity-view')?.textContent?.trim().slice(0, 240) || ''
            }));
            throw new Error(`Activity route did not open: ${JSON.stringify(state)}`, { cause: error });
        }
        console.log(`${name}: checking IndexedDB...`);
        await verifyIndexedDb(studentPage);

        console.log(`${name}: checking sandboxed game isolation...`);
        const sandboxPage = await studentContext.newPage();
        trackPageProblems(sandboxPage, `${name}:sandbox`, problems, {
            ignoredPageErrors: [/sandboxed and lacks the "allow-same-origin" flag/i]
        });
        await verifySandboxGame(sandboxPage);

        if (problems.length) {
            throw new Error(`${name} emitted browser errors:\n${problems.join('\n')}`);
        }
        console.log(`${name} cross-browser smoke passed.`);
    } catch (error) {
        if (problems.length) {
            error.message = `${error.message}\n${problems.join('\n')}`;
        }
        throw error;
    } finally {
        await browser.close().catch(() => {});
    }
}

const seeded = await seedLocalAuditData({ resetSubmissions: false });
const server = await ensureViteServer({
    baseUrl,
    probePath: '/student.html',
    host,
    port,
    external: Boolean(process.env.UI_CROSS_BROWSER_BASE_URL)
});

try {
    for (const engineName of selectedEngines) {
        const engine = browserEngines.get(engineName);
        if (!engine) throw new Error(`Unsupported cross-browser engine: ${engineName}`);
        await runEngine(engine[0], engine[1], seeded.browserConfig);
    }
    console.log(`${selectedEngines.map(name => browserEngines.get(name)[0]).join(' and ')} focused smoke coverage passed.`);
} finally {
    server?.kill();
}
