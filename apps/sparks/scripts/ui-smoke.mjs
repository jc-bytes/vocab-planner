import process from 'node:process';
import { chromium } from 'playwright';
import { assertNoAccessibilityViolations } from './lib/accessibility-audit.mjs';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_SMOKE_HOST || '127.0.0.1';
const port = Number(process.env.UI_SMOKE_PORT || 8560);
const baseUrl = (process.env.UI_SMOKE_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');
const sourceFixturesAvailable = process.env.UI_SMOKE_SOURCE_FIXTURES !== '0';
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

    if (route.label === 'Student') {
        const legacyCatalogRequests = await page.evaluate(() => performance.getEntriesByType('resource')
            .filter(entry => /\/vocabularies\//.test(new URL(entry.name).pathname)).map(entry => entry.name));
        if (legacyCatalogRequests.length) throw new Error(`Signed-out student requested legacy catalog: ${legacyCatalogRequests.join(', ')}`);
    }

    await assertNoAccessibilityViolations(page, `${route.label} signed-out shell`);

    const routeProblems = problems.slice(startProblemCount);
    if (routeProblems.length > 0) {
        throw new Error(`${route.label} emitted browser problems:\n${routeProblems.join('\n')}`);
    }
}

async function assertModalFocusLifecycle(page) {
    const waitForFocus = id => page.waitForFunction(
        expectedId => document.activeElement?.id === expectedId,
        id
    );

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
        document.body.innerHTML = `
            <button id="outside-trigger" type="button">Open parent</button>
            <button id="outside-control" type="button">Outside control</button>
            <div id="parent-modal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header"><h2>Parent dialog</h2></div>
                    <button id="parent-first" type="button">First</button>
                    <button id="open-child" type="button">Open child</button>
                    <button id="parent-last" type="button">Last</button>
                </div>
            </div>
            <div id="child-modal" class="modal hidden">
                <div class="modal-content">
                    <div class="modal-header"><h2>Child dialog</h2></div>
                    <input id="child-input">
                    <button id="child-last" type="button">Last child control</button>
                </div>
            </div>
            <div id="required-modal" class="modal hidden">
                <div class="modal-content"><h2>Required dialog</h2><button id="required-action">Continue</button></div>
            </div>
            <div id="transient-mount"></div>
        `;

        const modalApi = await import(`/js/main.js?modal-focus-smoke=${Date.now()}`);
        const closeCounts = { parent: 0, child: 0, replacement: 0 };
        const parent = document.querySelector('#parent-modal');
        const child = document.querySelector('#child-modal');
        const required = document.querySelector('#required-modal');

        modalApi.setupModal(parent, { onClose: () => { closeCounts.parent += 1; } });
        modalApi.setupModal(child, { onClose: () => { closeCounts.child += 1; } });
        modalApi.setupModal(required, { dismissible: false });
        document.querySelector('#outside-trigger').addEventListener('click', () => {
            modalApi.openModal(parent, { initialFocus: '#parent-first' });
        });
        document.querySelector('#open-child').addEventListener('click', () => {
            modalApi.openModal(child, { initialFocus: '#child-input' });
        });

        window.modalFocusSmoke = { modalApi, closeCounts };
    });

    await page.locator('#outside-trigger').click();
    await waitForFocus('parent-first');

    await assertNoAccessibilityViolations(page, 'Open managed dialog', {
        include: ['#parent-modal']
    });

    const parentState = await page.evaluate(() => ({
        labelledBy: document.querySelector('#parent-modal').getAttribute('aria-labelledby'),
        outsideInert: document.querySelector('#outside-control').inert,
        requiredMarker: document.querySelector('#required-modal').getAttribute('data-modal-required')
    }));
    if (!parentState.labelledBy || !parentState.outsideInert || parentState.requiredMarker !== 'true') {
        throw new Error(`Modal accessibility setup changed: ${JSON.stringify(parentState)}`);
    }

    await page.evaluate(() => {
        const dynamic = document.createElement('button');
        dynamic.id = 'parent-dynamic';
        dynamic.textContent = 'Dynamic control';
        document.querySelector('.modal-content').appendChild(dynamic);
        document.querySelector('#parent-last').focus();
    });
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.id) !== 'parent-dynamic') {
        throw new Error('The active trap did not include a dynamically inserted control.');
    }
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.id) !== 'parent-first') {
        throw new Error('Tab did not wrap inside the parent dialog.');
    }
    await page.keyboard.press('Shift+Tab');
    if (await page.evaluate(() => document.activeElement?.id) !== 'parent-dynamic') {
        throw new Error('Shift+Tab did not wrap inside the parent dialog.');
    }

    await page.locator('#open-child').click();
    await waitForFocus('child-input');
    if (!await page.evaluate(() => document.querySelector('#parent-modal').inert)) {
        throw new Error('Opening a nested dialog did not isolate the paused parent dialog.');
    }
    await page.locator('#child-last').focus();
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.id) !== 'child-input') {
        throw new Error('Tab did not wrap inside the nested dialog.');
    }
    await page.keyboard.press('Escape');
    await waitForFocus('open-child');
    await page.keyboard.press('Escape');
    await waitForFocus('outside-trigger');

    const closeState = await page.evaluate(() => {
        window.modalFocusSmoke.modalApi.closeModal('#parent-modal');
        return { ...window.modalFocusSmoke.closeCounts };
    });
    if (closeState.parent !== 1 || closeState.child !== 1) {
        throw new Error(`Modal close callbacks did not run exactly once: ${JSON.stringify(closeState)}`);
    }

    await page.locator('#outside-trigger').click();
    await waitForFocus('parent-first');
    await page.evaluate(() => document.querySelector('#parent-modal').click());
    await waitForFocus('outside-trigger');
    const backdropCloseState = await page.evaluate(() => {
        window.modalFocusSmoke.modalApi.closeModal('#parent-modal');
        return { ...window.modalFocusSmoke.closeCounts };
    });
    if (backdropCloseState.parent !== 2 || backdropCloseState.child !== 1) {
        throw new Error(`Backdrop dismissal or idempotent close changed: ${JSON.stringify(backdropCloseState)}`);
    }

    await page.evaluate(() => window.modalFocusSmoke.modalApi.openModal('#required-modal'));
    await waitForFocus('required-action');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('#required-modal').click());
    if (await page.locator('#required-modal').evaluate(modal => modal.classList.contains('hidden'))) {
        throw new Error('A required dialog was dismissed by Escape or its backdrop.');
    }
    await page.evaluate(() => window.modalFocusSmoke.modalApi.closeModal('#required-modal', { restoreFocus: false }));

    await page.evaluate(() => {
        window.modalFocusSmoke.modalApi.openModal('#required-modal');
        document.querySelector('#required-modal').classList.add('hidden');
    });
    await page.waitForTimeout(0);
    if (await page.evaluate(() => document.querySelector('#outside-control').inert)) {
        throw new Error('Hiding a managed dialog directly left its inert isolation active.');
    }

    await page.evaluate(() => {
        const mount = document.querySelector('#transient-mount');
        mount.innerHTML = '<div id="removed-modal" class="modal hidden"><div class="modal-content"><button>Old</button></div></div>';
        window.modalFocusSmoke.modalApi.openModal('#removed-modal');
        mount.replaceChildren();
    });
    await page.waitForTimeout(0);
    if (await page.evaluate(() => document.querySelector('#outside-control').inert)) {
        throw new Error('Removing an open dialog left its inert isolation active.');
    }

    await page.evaluate(() => {
        const mount = document.querySelector('#transient-mount');
        mount.innerHTML = '<div id="old-modal" class="modal hidden"><div class="modal-content"><button>Old</button></div></div>';
        window.modalFocusSmoke.modalApi.openModal('#old-modal');
        mount.innerHTML = '<div id="replacement-modal" class="modal hidden"><div class="modal-content"><button id="replacement-action">Replacement</button></div></div>';
        window.modalFocusSmoke.modalApi.openModal('#replacement-modal', {
            onClose: () => { window.modalFocusSmoke.closeCounts.replacement += 1; }
        });
    });
    await waitForFocus('replacement-action');
    await page.keyboard.press('Escape');
    const replacementCloseCount = await page.evaluate(() => window.modalFocusSmoke.closeCounts.replacement);
    if (replacementCloseCount !== 1) {
        throw new Error(`Replacement dialog close callback count changed: ${replacementCloseCount}`);
    }
}

async function assertThemeRoleSwitch(page) {
    await page.goto(`${baseUrl}/teacher.html`, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => {
        const fixture = document.createElement('div');
        fixture.id = 'theme-role-smoke';
        fixture.innerHTML = `
            <input id="theme-control" placeholder="Theme control">
            <button id="theme-secondary" class="btn secondary-btn">Secondary</button>
            <div id="theme-card" class="card" style="transition: none">Card</div>
            <div class="modal hidden"><div id="theme-dialog" class="modal-content">Dialog</div></div>
        `;
        document.body.appendChild(fixture);

        const readState = () => ({
            control: getComputedStyle(document.querySelector('#theme-control')).backgroundColor,
            secondaryBorder: getComputedStyle(document.querySelector('#theme-secondary')).borderColor,
            cardShadow: getComputedStyle(document.querySelector('#theme-card')).boxShadow,
            dialogShadow: getComputedStyle(document.querySelector('#theme-dialog')).boxShadow,
            placeholderRole: getComputedStyle(document.body).getPropertyValue('--color-placeholder').trim()
        });
        const before = readState();
        document.body.style.setProperty('--color-control-background', 'rgb(245, 245, 245)');
        document.body.style.setProperty('--color-border-interactive', 'rgb(12, 34, 56)');
        document.body.style.setProperty('--color-placeholder', 'rgb(78, 78, 78)');
        document.body.style.setProperty('--shadow-surface', '0 1px 2px rgb(11, 22, 33)');
        document.body.style.setProperty('--shadow-dialog', '0 2px 4px rgb(44, 55, 66)');
        const after = readState();
        fixture.remove();
        return { before, after };
    });

    for (const property of ['control', 'secondaryBorder', 'cardShadow', 'dialogShadow', 'placeholderRole']) {
        if (result.before[property] === result.after[property]) {
            throw new Error(`Theme role did not update ${property}: ${JSON.stringify(result)}`);
        }
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

    if (sourceFixturesAvailable) {
        currentLabel = 'Theme role switch';
        await assertThemeRoleSwitch(page);

        currentLabel = 'Modal focus lifecycle';
        await assertModalFocusLifecycle(page);

        const modalProblems = problems.filter(problem => problem.startsWith(`[${currentLabel}]`));
        if (modalProblems.length > 0) {
            throw new Error(`Modal focus lifecycle emitted browser problems:\n${modalProblems.join('\n')}`);
        }
    }

    const fixtureLabel = sourceFixturesAvailable ? ' and modal focus lifecycle' : '';
    console.log(`UI smoke passed for ${routes.map(route => route.path).join(', ')}${fixtureLabel} at ${baseUrl}`);
} finally {
    if (browser) await browser.close();
    if (server) server.kill();
}
