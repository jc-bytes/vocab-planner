import { spawn } from 'node:child_process';
import http from 'node:http';
import process from 'node:process';
import { chromium } from 'playwright';

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
        shellSelector: '.student-app-header',
        expectedTitle: 'Vocabulary Master - Student',
        expectLucide: true
    },
    {
        path: '/teacher.html',
        label: 'Teacher',
        shellSelector: '.teacher-app-header',
        expectedTitle: 'Vocabulary Master - Teacher',
        expectLucide: true
    }
];

function requestOk(url) {
    return new Promise((resolve) => {
        const request = http.get(url, (response) => {
            response.resume();
            resolve(response.statusCode >= 200 && response.statusCode < 500);
        });
        request.on('error', () => resolve(false));
        request.setTimeout(1000, () => {
            request.destroy();
            resolve(false);
        });
    });
}

async function waitForServer(url, timeoutMs = 10000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (await requestOk(url)) return true;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
}

async function resolveServer() {
    if (process.env.UI_SMOKE_BASE_URL) {
        if (!(await waitForServer(`${baseUrl}/student.html`, 3000))) {
            throw new Error(`UI_SMOKE_BASE_URL is not reachable: ${baseUrl}`);
        }
        return null;
    }

    if (await requestOk(`${baseUrl}/student.html`)) return null;

    const server = spawn('npx', ['vite', '--host', host, '--port', String(port), '--strictPort'], {
        cwd: process.cwd(),
        stdio: 'ignore'
    });

    if (!(await waitForServer(`${baseUrl}/student.html`))) {
        server.kill();
        throw new Error(`Could not start local server at ${baseUrl}`);
    }

    return server;
}

async function smokeRoute(page, route, problems) {
    const url = `${baseUrl}${route.path}`;
    const startProblemCount = problems.length;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator(route.shellSelector).first().waitFor({ state: 'visible', timeout: 10000 });
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
    const page = await browser.newPage();

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
