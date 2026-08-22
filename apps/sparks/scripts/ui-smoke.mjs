import process from 'node:process';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_SMOKE_HOST || '127.0.0.1';
const port = Number(process.env.UI_SMOKE_PORT || 8000);
const baseUrl = (process.env.UI_SMOKE_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');
const routes = [
    {
        path: '/',
        label: 'Home',
        shellSelector: '.landing-container',
        expectedTitle: 'Vocabulary Master'
    },
    {
        path: '/student.html',
        label: 'Student',
        shellSelector: '#login-view .login-container',
        hiddenSelector: '.student-app-header',
        expectedTitle: 'Vocabulary Master - Student',
        expectLucide: true
    },
    {
        path: '/teacher.html',
        label: 'Teacher',
        shellSelector: '#teacher-login-view .teacher-login-card',
        hiddenSelector: '.teacher-app-header',
        expectedTitle: 'Vocabulary Master - Teacher',
        expectLucide: true
    }
];

async function resolveServer() {
    return ensureViteServer({
        baseUrl,
        probePath: '/student.html',
        host,
        port,
        external: Boolean(process.env.UI_SMOKE_BASE_URL)
    });
}

async function smokeRoute(page, route, problems) {
    const url = `${baseUrl}${route.path}`;
    const startProblemCount = problems.length;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator(route.shellSelector).first().waitFor({ state: 'visible', timeout: 10000 });
    if (route.hiddenSelector) {
        await page.locator(route.hiddenSelector).first().waitFor({ state: 'hidden', timeout: 10000 });
    }
    await page.waitForTimeout(500);

    const title = await page.title();
    if (title !== route.expectedTitle) {
        throw new Error(`${route.label} title mismatch: expected "${route.expectedTitle}", got "${title}"`);
    }

    if (route.expectLucide) {
        const iconState = await page.evaluate(() => ({
            hasAdapter: Boolean(window.lucide?.createIcons),
            svgCount: document.querySelectorAll('svg.lucide').length,
            stalePlaceholders: document.querySelectorAll('i[data-lucide]').length
        }));

        if (!iconState.hasAdapter || iconState.svgCount === 0) {
            throw new Error(`${route.label} did not hydrate local Lucide icons: ${JSON.stringify(iconState)}`);
        }
    }

    const routeProblems = problems.slice(startProblemCount);
    if (routeProblems.length > 0) {
        throw new Error(`${route.label} emitted browser problems:\n${routeProblems.join('\n')}`);
    }
}

let server = null;
let browser = null;
let currentLabel = 'startup';
const problems = [];

try {
    server = await resolveServer();
    browser = await chromium.launch();
    const context = await browser.newContext();
    await context.addInitScript(() => {
        window.SUPABASE_CONFIG = {
            url: 'http://127.0.0.1:54321',
            publishableKey: 'ui-smoke-placeholder-key'
        };
    });
    const page = await context.newPage();

    page.on('console', (message) => {
        const text = message.text();
        if (message.type() === 'error') {
            problems.push(`[${currentLabel}] console.error: ${text}`);
        }
        if (text.includes('Element not found for listener: #menu-arcade-btn')) {
            problems.push(`[${currentLabel}] stale arcade listener warning: ${text}`);
        }
    });
    page.on('pageerror', (error) => {
        problems.push(`[${currentLabel}] pageerror: ${error.message}`);
    });

    for (const route of routes) {
        currentLabel = route.label;
        await smokeRoute(page, route, problems);
    }

    console.log(`UI smoke passed for ${routes.map(route => route.path).join(', ')} at ${baseUrl}`);
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
