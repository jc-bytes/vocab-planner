import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { collectStudentPrecacheFiles } from './student-precache.mjs';
import { validateLazyBuildContracts } from './lib/lazyBuildContracts.mjs';
import { fingerprintBuildInputs } from './lib/buildArtifactIdentity.mjs';

// This checks an already-published release. It never deploys, seeds, signs in,
// submits a form, reads saved sessions, or substitutes network/config responses.
const values = process.argv.slice(2);
const option = (name, fallback) => {
    const index = values.indexOf(name);
    if (index < 0) return fallback;
    assert.ok(values[index + 1] && !values[index + 1].startsWith('--'), `${name} requires a value`);
    return values[index + 1];
};
const allowed = new Set(['--url', '--expected-dir', '--output', '--concurrency']);
for (let index = 0; index < values.length; index += 2) assert.ok(allowed.has(values[index]), `Unknown option ${values[index]}`);
const base = new URL(option('--url', 'https://jc-bytes.github.io/vocab-planner/'));
assert.equal(base.protocol, 'https:', 'Hosted verification requires HTTPS.');
assert.ok(!base.username && !base.password && !base.search && !base.hash, 'Use a site URL without credentials, query or hash.');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const expectedRoot = resolve(option('--expected-dir', 'dist-desktop'));
const output = resolve(option('--output', '/tmp/sparks-hosted-release-verification'));
assert.ok(output !== expectedRoot && !output.startsWith(expectedRoot + sep), 'Verification evidence cannot change the expected artifact.');
const concurrency = Number(option('--concurrency', '4'));
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 8, 'Concurrency must be from one to eight.');
const digest = data => createHash('sha256').update(data).digest('hex');
const safeName = name => {
    assert.ok(typeof name === 'string' && name && !name.startsWith('/') && !name.includes('\\')
        && !name.split('/').some(part => !part || part === '.' || part === '..'), 'Artifact names must stay inside the release directory.');
    return name;
};
const localFile = name => readFile(join(expectedRoot, safeName(name)));
const targetUrl = name => {
    const url = new URL(safeName(name), base);
    assert.ok(url.origin === base.origin && url.pathname.startsWith(base.pathname), 'An artifact request escaped the hosted site.');
    return url;
};
const cleanError = value => String(value).replace(/(?:https?:\/\/)[^\s)"']+/g, url => {
    try { const parsed = new URL(url); return parsed.origin + parsed.pathname; } catch { return '[URL]'; }
}).replace(/[A-Za-z0-9_-]{45,}/g, '[redacted]');
const report = { startedAt: new Date().toISOString(), site: base.href, expectedRoot, output,
    limits: ['Public signed-out flows only; no authenticated teacher/student data acceptance.',
        'Browser dimensions are emulated; physical classroom devices are not verified.',
        'GET byte checks do not establish sustained production capacity or outage behavior.'],
    artifact: {}, http: { checked: 0, failures: [] }, browser: [], passed: false };
let browser;
await mkdir(output, { recursive: true });
try {
    const identity = JSON.parse(await localFile('.vite/artifact-identity.json'));
    const manifest = JSON.parse(await localFile('.vite/manifest.json'));
    assert.equal(identity.version, 1, 'Expected artifact identity format changed.');
    assert.ok(identity.outputs && Object.keys(identity.outputs).length, 'Expected artifact has no output identity.');
    const inputs = await fingerprintBuildInputs(process.cwd());
    assert.equal(inputs.digest, identity.inputs?.digest, 'Expected artifact does not match current application/build sources.');
    // Post-build hosting may append retained old assets and adjacent sites. Their
    // presence cannot replace or excuse any current, stamped release output.
    const expected = new Map();
    for (const [name, hash] of Object.entries(identity.outputs)) {
        safeName(name);
        assert.equal(digest(await localFile(name)), hash, `Expected artifact bytes changed: ${name}`);
        if (!name.startsWith('.vite/')) expected.set(name, hash);
    }
    for (const name of ['index.html', 'student.html', 'teacher.html', 'student-preview.html', 'student-sw.js'])
        assert.ok(expected.has(name), `Required current entry is missing: ${name}`);
    for (const [key, entry] of Object.entries(manifest)) {
        for (const child of [...(entry.imports || []), ...(entry.dynamicImports || [])])
            assert.ok(manifest[child], `Manifest edge ${key} points to missing ${child}`);
        for (const name of [entry.file, ...(entry.css || []), ...(entry.assets || [])].filter(Boolean))
            assert.ok(expected.has(name), `Manifest output has no verified release bytes: ${name}`);
    }
    const studentEntry = Object.keys(manifest).find(key => manifest[key].isEntry && manifest[key].src === 'student.html');
    assert.ok(studentEntry, 'Student entry is missing.');
    const precache = collectStudentPrecacheFiles(manifest, studentEntry);
    const lazy = validateLazyBuildContracts(manifest, { precacheFiles: precache });
    const worker = (await localFile('student-sw.js')).toString('utf8');
    for (const name of precache) {
        assert.ok(expected.has(name), `Student precache output is missing: ${name}`);
        assert.ok(worker.includes(name), `Published worker source omits student graph output: ${name}`);
    }
    const workerImports = [...new Set([...worker.matchAll(/(?:\.\/)?(student-sw-lifecycle-[A-Za-z0-9_-]+\.js|workbox-[A-Za-z0-9_-]+\.js)/g)].map(match => match[1]))];
    assert.ok(workerImports.some(name => name.startsWith('student-sw-lifecycle-')), 'Worker lifecycle import is missing.');
    for (const name of workerImports) assert.ok(expected.has(name), `Worker import is absent from the expected artifact: ${name}`);
    report.artifact = { inputDigest: inputs.digest, configurationDigest: identity.configuration?.digest,
        currentFiles: expected.size, manifestRecords: Object.keys(manifest).length, studentPrecacheFiles: precache.size,
        workerImports, lazyEdges: lazy.checkedEdges, optionalFeatureBoundaries: lazy.optionalFeatureCount };
    const jobs = [...expected];
    let position = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
        while (position < jobs.length) {
            const [name, hash] = jobs[position++];
            try {
                const response = await fetch(targetUrl(name), { signal: AbortSignal.timeout(20000), redirect: 'error',
                    cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
                assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
                const mime = response.headers.get('content-type') || '';
                const suffix = extname(name);
                if (suffix === '.js') assert.match(mime, /(?:javascript|ecmascript)/i, `${name}: expected JavaScript MIME`);
                if (suffix === '.css') assert.match(mime, /text\/css/i, `${name}: expected stylesheet MIME`);
                if (suffix === '.html') assert.match(mime, /text\/html/i, `${name}: expected HTML MIME`);
                if (suffix === '.json') assert.match(mime, /(?:application\/json|text\/json)/i, `${name}: expected JSON MIME`);
                const body = Buffer.from(await response.arrayBuffer());
                assert.equal(digest(body), hash, `${name}: hosted bytes differ from the tested release`);
                if (['index.html', 'student.html', 'teacher.html', 'student-preview.html'].includes(name)) {
                    const html = body.toString('utf8');
                    assert.match(html, /http-equiv=["']Content-Security-Policy["']/i, `${name}: CSP is missing`);
                    assert.match(html, /script-src 'self'/, `${name}: self-only script policy is missing`);
                    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, `${name}: inline executable script found`);
                }
                report.http.checked++;
            } catch (error) { report.http.failures.push({ file: name, message: cleanError(error.message) }); }
        }
    }));
    assert.equal(report.http.failures.length, 0, `${report.http.failures.length} current release files failed HTTP/identity verification.`);
    browser = await chromium.launch();
    for (const [surface, file, ready] of [
        ['landing', 'index.html', '.landing-options'],
        ['student', 'student.html', '#student-login-form'],
        ['teacher', 'teacher.html', '#teacher-login-form']
    ]) for (const width of [320, 390, 768, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
        const page = await context.newPage(), errors = [], failures = [], mutations = [];
        page.on('pageerror', error => errors.push(cleanError(error.message)));
        page.on('requestfailed', request => failures.push({ path: new URL(request.url()).pathname,
            message: cleanError(request.failure()?.errorText || 'Request failed') }));
        page.on('request', request => {
            if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push({ method: request.method(), path: new URL(request.url()).pathname });
        });
        const sample = { surface, width, errors, failures, mutations, passed: false };
        report.browser.push(sample);
        try {
            const response = await page.goto(targetUrl(file).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
            assert.equal(response.status(), 200);
            await page.locator(ready).waitFor({ state: 'visible', timeout: 20000 });
            await page.waitForLoadState('networkidle', { timeout: 20000 });
            await page.evaluate(async () => {
                let timer;
                try { await Promise.race([document.fonts.ready,
                    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Public fonts did not settle.')), 10000); })]); }
                finally { clearTimeout(timer); }
            });
            const geometry = await page.evaluate(() => {
                const visible = [...document.querySelectorAll('a,button,input,select')].filter(node => {
                    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
                    return rect.width && rect.height && style.visibility !== 'hidden' && style.display !== 'none';
                });
                return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
                    outside: visible.filter(node => { const rect = node.getBoundingClientRect(); return rect.left < -1 || rect.right > innerWidth + 1; })
                        .map(node => ({ tag: node.tagName, label: node.getAttribute('aria-label') || node.textContent.trim().slice(0, 90) })) };
            });
            sample.geometry = geometry;
            assert.ok(geometry.scrollWidth <= width + 1, `${surface}/${width}: horizontal document overflow`);
            assert.deepEqual(geometry.outside, [], `${surface}/${width}: interactive controls leave the viewport`);
            if (surface === 'landing') {
                assert.ok(await page.locator('a[href="student.html"]').isVisible());
                assert.ok(await page.locator('a[href="teacher.html"]').isVisible());
            } else {
                const prefix = surface === 'student' ? 'login' : 'teacher';
                assert.ok(await page.locator(`#${prefix}-email`).isVisible());
                assert.equal(await page.locator(`#${prefix}-password`).getAttribute('type'), 'password');
                // These open public dialogs only. No email/password is entered,
                // and neither account creation nor recovery is submitted.
                const recover = page.getByRole('button', { name: 'Forgot password?', exact: true });
                await recover.click();
                await page.getByRole('heading', { name: 'Recover your account', exact: true }).waitFor();
                await page.getByRole('button', { name: 'Close', exact: true }).click();
            }
            const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
            sample.accessibility = { violations: accessibility.violations.map(({ id, impact, help, nodes }) => ({ id, impact, help,
                targets: nodes.map(node => node.target) })), incomplete: accessibility.incomplete.length };
            await page.screenshot({ path: join(output, `${surface}-${width}.png`), fullPage: true });
            assert.deepEqual(errors, [], `${surface}/${width}: unhandled browser errors`);
            assert.deepEqual(failures, [], `${surface}/${width}: failed live network requests`);
            assert.deepEqual(mutations, [], `${surface}/${width}: unexpected state-changing request during public read-only checks`);
            assert.deepEqual(sample.accessibility.violations, [], `${surface}/${width}: WCAG accessibility violations`);
            sample.passed = true;
        } finally { await context.close(); }
    }
    report.passed = true;
} catch (error) {
    report.error = cleanError(error.message);
    process.exitCode = 1;
} finally {
    await browser?.close();
    report.finishedAt = new Date().toISOString();
    await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ passed: report.passed, filesChecked: report.http.checked, fileFailures: report.http.failures.length,
        browserSamples: report.browser.length, error: report.error, report: join(output, 'report.json') }));
}
