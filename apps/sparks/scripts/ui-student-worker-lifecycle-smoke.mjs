import assert from 'node:assert/strict';
import http from 'node:http';
import { cp, mkdtemp, readFile, writeFile, rename, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { chromium } from 'playwright';
import { generateSW } from 'workbox-build';
import { generateStudentServiceWorker } from './generate-service-worker.mjs';
import { collectStudentShellFiles } from './student-precache.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
if (process.env.STUDENT_WORKER_LIFECYCLE_REUSE !== '1') {
    console.log('Building current production assets for the student worker upgrade check.');
    await run('npm', ['run', 'desktop:build:web'], { cwd: root, maxBuffer: 20 * 1024 * 1024 });
}
const temporary = await mkdtemp(join(tmpdir(), 'sparks-worker-lifecycle-'));
const builds = new Map();
const updater = await readFile(join(root, 'js/student/studentAppUpdates.js'));
const graphOptions = { navigationGraceMs: 100, cleanupIntervalMs: 0 };
let browser, server, releaseInstall;
try {
    const original = JSON.parse(await readFile(join(root, 'dist-desktop/.vite/manifest.json')));
    for (const version of ['A', 'B', 'C', 'D']) {
        const outputDirectory = join(temporary, version);
        await cp(join(root, 'dist-desktop'), outputDirectory, { recursive: true });
        const manifest = structuredClone(original);
        const names = new Map();
        if (version !== 'A') {
            // Derive complete, valid artifacts with distinct immutable code URLs.
            // Rewrite every emitted code reference, including cyclic chunk imports.
            for (const entry of Object.values(manifest)) {
                for (const file of [entry.file, ...(entry.css || [])]) {
                    if (/\.(js|css)$/.test(file)) names.set(file, file.replace(/\.(js|css)$/, `-${version}.$1`));
                }
            }
            for (const [from, to] of names) await rename(join(outputDirectory, from), join(outputDirectory, to));
            for (const file of await readdir(join(outputDirectory, 'assets'))) {
                if (!/\.(js|css)$/.test(file)) continue;
                const path = join(outputDirectory, 'assets', file);
                let source = await readFile(path, 'utf8');
                for (const [from, to] of names) source = source.replaceAll(basename(from), basename(to));
                await writeFile(path, source);
            }
            for (const entry of Object.values(manifest)) {
                entry.file = names.get(entry.file) || entry.file;
                if (entry.css) entry.css = entry.css.map(file => names.get(file) || file);
            }
        }
        await writeFile(join(outputDirectory, '.vite/manifest.json'), JSON.stringify(manifest));
        await writeFile(join(outputDirectory, 'student.html'), `<!doctype html><input id="draft" value="draft ${version}"><script type="module">
            import { installStudentAppUpdates } from './worker-audit-updates.js';
            window.auditVersion = '${version}';
            window.studentApp = { currentActivityType: 'matching', progress: {
                saveLocalProgress() { sessionStorage.setItem('savedDraft', document.querySelector('#draft').value); }
            }};
            window.stopUpdates = installStudentAppUpdates();
        </script>`);
        let generated;
        if (version === 'A') {
            const shell = collectStudentShellFiles(manifest, 'student.html');
            await generateSW({ cacheId: 'vocabulary-student', cleanupOutdatedCaches: true, clientsClaim: true,
                skipWaiting: true, globDirectory: outputDirectory, globPatterns: [],
                additionalManifestEntries: [...shell].map(url => ({ url, revision: 'legacy-A' })),
                navigateFallback: 'student.html', navigateFallbackAllowlist: [/\/student(?:\.html)?$/],
                swDest: join(outputDirectory, 'student-sw.js'), sourcemap: false });
        } else {
            generated = await generateStudentServiceWorker({ outputDirectory, lifecycleOptions: graphOptions });
        }
        builds.set(version, { outputDirectory, manifest, generated });
    }
    let serving = 'A', installRequested;
    const pendingInstall = new Promise(resolve => { installRequested = resolve; });
    const heldCode = builds.get('D').manifest['js/classroomView.js'].file;
    server = http.createServer(async (request, response) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        response.setHeader('Cache-Control', 'no-store');
        if (serving === 'D' && pathname === '/' + heldCode) {
            installRequested();
            await new Promise(resolve => { releaseInstall = resolve; });
        }
        try {
            const contents = pathname === '/assets/runtime-only.js' ? Buffer.from('window.runtimeOnlyLoaded = true;')
                : pathname === '/worker-audit-updates.js' ? updater
                : await readFile(join(builds.get(serving).outputDirectory, pathname));
            response.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript'
                : pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.html') ? 'text/html' : 'application/octet-stream');
            response.end(contents);
        } catch {
            response.statusCode = 404;
            response.end('This deployment no longer contains that artifact.');
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch();
    const context = await browser.newContext();
    context.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') console.log('Worker browser:', message.text()); });
    const errors = [];
    context.on('weberror', error => errors.push(error.error().message));
    const cacheFor = version => `${builds.get(version).generated.cachePrefix}-precache-v2-${origin}/`;
    async function currentCache(page) {
        return page.evaluate(async () => {
            const metadata = await caches.open('vocabulary-student-versions-' + location.origin + '/');
            return (await metadata.match(location.origin + '/__sparks_worker__/current'))?.json();
        });
    }
    async function waitCurrent(page, version) {
        for (let attempt = 0; attempt < 200; attempt++) {
            if (await currentCache(page) === cacheFor(version)) return;
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.log('Activation state:', await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {active:r?.active?.state,waiting:r?.waiting?.state,installing:r?.installing?.state,keys:await caches.keys()};}));
        throw new Error(`Worker ${version} did not finish activating.`);
    }
    async function update(page, version) {
        serving = version;
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await waitCurrent(page, version);
    }
    async function cleanup() {
        // Find the active worker by its installed configuration, not array order.
        for (const worker of context.serviceWorkers()) {
            const active = await worker.evaluate(async () => {
                if (!self.studentWorkerLifecycle) return false;
                await self.studentWorkerLifecycle.cleanup({ force: true });
                return true;
            }).catch(() => false);
            if (active) break;
        }
    }
    const old = await context.newPage();
    await old.goto(origin + '/student.html#/sparks');
    await old.evaluate(async () => {
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    await old.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await update(old, 'B');
    assert.equal(await old.inputValue('#draft'), 'draft A', 'Unsafe work must stay open after controller replacement');
    assert.equal(await old.evaluate(() => window.auditVersion), 'A');
    const missingLegacy = await old.evaluate(async file => {
        try { await import('/' + file); return false; } catch { return true; }
    }, builds.get('A').manifest['js/classroomView.js'].file);
    assert.equal(missingLegacy, true, 'First upgrade cannot recover a never-cached, already removed legacy artifact');

    const pageB = await context.newPage();
    await pageB.goto(origin + '/student.html#/sparks');
    assert.equal(await pageB.evaluate(() => window.auditVersion), 'B');
    async function loadRuntimeScript() {
        return pageB.evaluate(() => new Promise((resolve, reject) => {
            window.runtimeOnlyLoaded = false;
            const script = document.createElement('script');
            script.src = '/assets/runtime-only.js';
            script.onload = () => { script.remove(); resolve(window.runtimeOnlyLoaded); };
            script.onerror = () => { script.remove(); reject(new Error('Runtime script failed')); };
            document.head.append(script);
        }));
    }
    assert.equal(await loadRuntimeScript(), true);
    await pageB.waitForFunction(async () => !!await caches.match('/assets/runtime-only.js', { cacheName: 'vocabulary-student-code-v1' }));
    await context.setOffline(true);
    assert.equal(await loadRuntimeScript(), true, 'Unknown hashed scripts preserve native runtime caching offline');
    await context.setOffline(false);
    await old.close();
    await update(pageB, 'C');
    assert.equal(await pageB.evaluate(() => window.auditVersion), 'B');
    const oldCode = builds.get('B').manifest['js/classroomView.js'].file;
    assert.equal(await pageB.evaluate(async file => typeof (await import('/' + file)).createClassroomView, oldCode), 'function');
    await pageB.evaluate(async ({ file, name }) => {
        const cache = await caches.open(name);
        const key = (await cache.keys()).find(request => new URL(request.url).pathname === '/' + file);
        const response = await cache.match(key);
        const headers = new Headers(response.headers);
        headers.set('Date', 'Thu, 01 Jan 1970 00:00:00 GMT');
        await cache.put(key, new Response(await response.arrayBuffer(), { status: response.status, headers }));
    }, { file: oldCode, name: cacheFor('B') });
    await context.setOffline(true);
    assert.equal(await pageB.evaluate(async file => typeof (await import('/' + file + '?offline-proof')).createClassroomView, oldCode), 'function', 'Retained graph code remains usable beyond runtime cache expiration');
    await context.setOffline(false);
    const pageC = await context.newPage();
    await pageC.goto(origin + '/student.html#/sparks');
    assert.equal(await pageC.evaluate(() => window.auditVersion), 'C');
    const records = await pageB.evaluate(async () => {
        const metadata = await caches.open('vocabulary-student-versions-' + location.origin + '/');
        const rows = [];
        for (const key of await metadata.keys()) if (key.url.includes('/clients/')) rows.push(await (await metadata.match(key)).json());
        return rows;
    });
    assert.ok(records.some(record => record.caches.length === 1 && record.caches[0] === cacheFor('B')));
    assert.ok(records.some(record => record.caches.length === 1 && record.caches[0] === cacheFor('C')));
    await pageC.close();
    await new Promise(resolve => setTimeout(resolve, 120));
    serving = 'D';
    const installing = pageB.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await pendingInstall;
    await cleanup();
    assert.ok(await pageB.evaluate(async name => (await caches.keys()).includes(name), cacheFor('D')), 'Cleanup must preserve an in-progress install cache');
    releaseInstall();
    await installing;
    await waitCurrent(pageB, 'D');
    assert.equal(await pageB.evaluate(() => window.auditVersion), 'B');
    assert.equal(await pageB.inputValue('#draft'), 'draft B');
    await pageB.evaluate(() => { studentApp.currentActivityType = null; location.hash = '#/units'; });
    await pageB.waitForFunction(() => window.auditVersion === 'D');
    assert.equal(await pageB.evaluate(() => sessionStorage.getItem('savedDraft')), 'draft B', 'Safe-menu reload must save the current draft first');
    await new Promise(resolve => setTimeout(resolve, 120));
    await cleanup();
    const retained = await pageB.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('vocabulary-student-graph-')));
    assert.deepEqual(retained, [cacheFor('D')], 'Closed documents release every predecessor graph');
    assert.deepEqual(errors, [], 'Upgrade routing must not register a second navigation respondWith or throw browser errors');
    console.log('Student worker lifecycle passed: legacy compatibility, four versions, unsafe/safe updates, offline old code, navigation leases, install protection, and closed-tab cleanup.');
} finally {
    releaseInstall?.();
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(temporary, { recursive: true, force: true });
}
