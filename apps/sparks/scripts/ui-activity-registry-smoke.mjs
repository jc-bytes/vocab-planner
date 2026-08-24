import process from 'node:process';
import { chromium } from 'playwright';

import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = process.env.UI_ACTIVITY_REGISTRY_HOST || '127.0.0.1';
const port = Number(process.env.UI_ACTIVITY_REGISTRY_PORT || 8125);
const baseUrl = (process.env.UI_ACTIVITY_REGISTRY_BASE_URL || `http://${host}:${port}`).replace(/\/$/, '');

let server = null;
let browser = null;

try {
    server = await ensureViteServer({
        baseUrl,
        probePath: '/student.html',
        host,
        port,
        external: Boolean(process.env.UI_ACTIVITY_REGISTRY_BASE_URL)
    });
    browser = await chromium.launch();
    const context = await browser.newContext();
    await context.addInitScript(() => {
        window.SUPABASE_CONFIG = {
            url: 'http://127.0.0.1:54321',
            publishableKey: 'activity-registry-smoke-placeholder-key'
        };
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(`${baseUrl}/student.html`, { waitUntil: 'domcontentloaded' });

    const loadedActivityIds = await page.evaluate(async () => {
        const { STUDENT_ACTIVITY_REGISTRY } = await import('/js/student/studentActivityRegistry.js');
        return Promise.all(STUDENT_ACTIVITY_REGISTRY.map(async activity => {
            const activityModule = await activity.load();
            if (typeof activityModule[activity.exportName] !== 'function') {
                throw new Error(`${activity.id} did not load ${activity.exportName}`);
            }
            return activity.id;
        }));
    });

    if (pageErrors.length > 0) {
        throw new Error(`Activity registry smoke emitted page errors:\n${pageErrors.join('\n')}`);
    }
    console.log(`Activity registry smoke loaded ${loadedActivityIds.length} declared exports.`);
} finally {
    await browser?.close().catch(() => {});
    server?.kill();
}
