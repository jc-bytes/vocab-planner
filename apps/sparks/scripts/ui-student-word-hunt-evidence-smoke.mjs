import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';

const port = Number(process.env.UI_STUDENT_WORD_HUNT_EVIDENCE_PORT || 19888);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_STUDENT_WORD_HUNT_EVIDENCE_DIST === '1';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const dataUrl = `data:image/png;base64,${png}`;
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
const ioPath = built ? manifest['js/student/studentWordHuntEvidenceIO.js']?.file : 'js/student/studentWordHuntEvidenceIO.js';
assert.ok(ioPath, 'The compiled evidence entry must exist in the current artifact manifest');
const reportPath = built ? manifest['js/reportGenerator.js']?.file : 'js/reportGenerator.js';
assert.ok(reportPath, 'The report entry must exist in the current artifact manifest');
let server, browser;
async function drawingRows(page) {
    return page.evaluate(async () => {
        if (!(await indexedDB.databases()).some(db => db.name === 'VocabAppDB')) return [];
        const db = await new Promise((resolve, reject) => { const open = indexedDB.open('VocabAppDB'); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        try {
            const rows = await new Promise((resolve, reject) => { const read = db.transaction('drawings').objectStore('drawings').getAll(); read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); });
            return rows.map(row => ({ owner: row.ownerUserId, unit: row.vocabName, word: row.word, type: row.blob.type, bytes: row.blob.size }));
        } finally { db.close(); }
    });
}
const settled = page => page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute);
try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const scenario of ['account', 'unit', 'healthy']) {
        const page = await browser.newPage({ acceptDownloads: true });
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        // The assigned-flow backend is synthetic; keep its unrelated realtime endpoint local too.
        await page.routeWebSocket('wss://fixture.supabase.co/**', socket => { socket.onMessage(() => {}); });
        const ioRequests = [], storage = [], evidenceWarnings = [], consoleErrors = [];
        page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
        page.on('console', message => { if (message.type() === 'warning' && /Word Hunt|legacy/.test(message.text())) evidenceWarnings.push(message.text()); });
        page.on('request', request => { if (new URL(request.url()).pathname === `/${ioPath}`) ioRequests.push(request.url()); });
        await page.route('https://fixture.supabase.co/storage/v1/object/**', async route => {
            const request = route.request(), url = new URL(request.url());
            if (request.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST' } });
            storage.push({ method: request.method(), path: url.pathname });
            const headers = { 'access-control-allow-origin': '*' };
            if (request.method() === 'GET') return route.fulfill({ status: 200, headers, contentType: 'image/png', body: Buffer.from(png, 'base64') });
            await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ Id: '88888888-8888-4888-8888-888888888888', Key: url.pathname.split('/object/')[1] }) });
        });
        await page.goto(`${baseUrl}/student.html#/menu`); await settled(page);
        await page.evaluate(() => studentApp.navigateTo({ view: 'units' })); await settled(page);
        await page.evaluate(() => studentApp.navigateTo({ view: 'arcade' })); await settled(page);
        await page.evaluate(id => studentApp.navigateTo({ view: 'unit', unitId: `assignment.${id}` }), fixture.ids.assignment);
        await settled(page);
        await page.locator('#activity-menu-view.active').waitFor();
        assert.equal(ioRequests.length, 0, `${scenario}: ordinary Home/Units/Arcade/unit menu must not request evidence IO`);
        const before = await drawingRows(page);
        await page.evaluate(({ dataUrl, scenario }) => {
            const app = studentApp, unit = app.activities.progressFlow.getCurrentUnitProgress();
            unit.images.Source = dataUrl; unit.wordHunt.Source = { definition: 'Preserve captured writing' };
            window.evidenceProbe = { unit, originalUser: app.currentUser, originalVocab: app.currentVocab, started: false };
            if (scenario !== 'healthy') {
                const originalEncode = HTMLCanvasElement.prototype.toBlob;
                let release;
                const held = new Promise(resolve => { release = resolve; });
                HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
                    return originalEncode.call(this, blob => { evidenceProbe.started = true; held.then(() => callback(blob)); }, ...args);
                };
                evidenceProbe.release = () => { HTMLCanvasElement.prototype.toBlob = originalEncode; release(); };
            }
            evidenceProbe.operation = app.activities.wordHunt.migrateLegacyWordHuntImages();
        }, { dataUrl, scenario });
        if (scenario !== 'healthy') {
            await page.waitForFunction(() => evidenceProbe.started);
            await page.evaluate(scenario => {
                if (scenario === 'account') studentApp.currentUser = { uid: '99999999-9999-4999-8999-999999999999' };
                else studentApp.currentVocab = { ...studentApp.currentVocab, assignmentId: '99999999-9999-4999-8999-999999999999' };
                evidenceProbe.release();
                return evidenceProbe.operation;
            }, scenario);
            assert.deepEqual(await drawingRows(page), before, `${scenario}: stale processing must not write any drawing`);
            assert.equal(storage.length, 0, `${scenario}: stale processing must not dispatch Storage`);
            assert.deepEqual(await page.evaluate(() => ({ legacy: evidenceProbe.unit.images.Source.startsWith('data:image/'), entry: evidenceProbe.unit.wordHunt.Source })),
                { legacy: true, entry: { definition: 'Preserve captured writing' } });
        } else {
            await page.evaluate(() => evidenceProbe.operation);
            const drawings = await drawingRows(page);
            assert.equal(drawings.length, before.length + 1, JSON.stringify({ drawings, storage, evidenceWarnings, state: await page.evaluate(() => ({ hasLegacy: Boolean(evidenceProbe.unit.images.Source), entry: evidenceProbe.unit.wordHunt.Source, currentUser: Boolean(studentApp.currentUser), assignment: studentApp.currentVocab.assignmentId })) }));
            assert.deepEqual({ ...drawings.at(-1), bytes: undefined }, { owner: fixture.ids.user, unit: `assignment:${fixture.ids.assignment}`, word: 'Source', type: 'image/webp', bytes: undefined });
            assert.ok(drawings.at(-1).bytes > 0 && drawings.at(-1).bytes < 65536);
            assert.deepEqual(storage, [{ method: 'POST', path: `/storage/v1/object/word-hunt-images/${fixture.ids.assignment}/${fixture.ids.user}/source.webp` }]);
            assert.equal(await page.evaluate(() => evidenceProbe.unit.images.Source), undefined);
            assert.equal(await page.evaluate(() => evidenceProbe.unit.wordHunt.Source.hasImage), true);
            await page.evaluate(id => studentApp.navigateTo({ view: 'activity', unitId: `assignment.${id}`, activityType: 'illustration' }), fixture.ids.assignment);
            await settled(page);
            await page.waitForFunction(() => studentApp.currentActivityType === 'illustration' && studentApp.activityInstance?.container?.querySelector('.word-hunt-wrapper'));
            const saved = await page.evaluate(() => {
                studentApp.activityInstance.updateEntryField('definition', 'Current callback preserved');
                return studentApp.activities.progressFlow.getCurrentUnitProgress().wordHunt.Source.definition;
            });
            assert.equal(saved, 'Current callback preserved');
            // A report owns a snapshot, while same-unit writing may continue during its deferred import.
            let releaseReport;
            const heldReport = new Promise(resolve => { releaseReport = resolve; });
            await page.route(`${baseUrl}/${reportPath}*`, async route => { await heldReport; await route.continue(); });
            const reportRequested = page.waitForRequest(request => new URL(request.url()).pathname === `/${reportPath}`, { timeout: 10000 });
            const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
            await page.evaluate(() => { evidenceProbe.exportOperation = studentApp.activities.downloadWordHuntSubmission(); });
            await reportRequested;
            await page.evaluate(() => {
                studentApp.activities.getReportWordHuntEntries();
                studentApp.activityInstance.updateEntryField('definition', 'New draft after export snapshot');
            });
            releaseReport();
            await page.evaluate(() => evidenceProbe.exportOperation);
            const download = await downloadPromise;
            assert.match(download.suggestedFilename(), /\.pdf$/i); assert.equal(await download.failure(), null);
            const stream = await download.createReadStream(), chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const pdf = Buffer.concat(chunks);
            assert.equal(pdf.subarray(0, 5).toString(), '%PDF-'); assert.ok(pdf.length > 2000);
            assert.equal(await page.evaluate(() => studentApp.activities.wordHunt.wordHuntExportInProgress), false);
            assert.equal(await page.locator('#download-word-hunt-btn').isEnabled(), true);
            assert.equal(await page.evaluate(() => studentApp.activities.progressFlow.getCurrentUnitProgress().wordHunt.Source.definition), 'New draft after export snapshot');
        }
        assert.ok(ioRequests.length > 0, `${scenario}: actual app must exercise the deferred evidence entry`);
        assert.deepEqual(fixture.errors, []);
        assert.deepEqual(consoleErrors, [], `${scenario}: actual app console errors`);
        await page.close();
        console.log(`${built ? 'built' : 'source'} ${scenario}: actual app/ProgressFlow, real IndexedDB and canvas evidence control passed`);
    }
} finally { await browser?.close(); server?.kill(); }
