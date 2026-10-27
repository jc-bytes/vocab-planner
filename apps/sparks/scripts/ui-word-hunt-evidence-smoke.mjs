import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const host = '127.0.0.1', port = Number(process.env.UI_WORD_HUNT_EVIDENCE_PORT || 19887);
const baseUrl = `http://${host}:${port}`;
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/', host, port });
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Use real source modules/canvas without booting an authenticated application or touching fixtures.
    await page.route(`${baseUrl}/__word-hunt-evidence`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Evidence probe</title><body></body>' }));
    await page.goto(`${baseUrl}/__word-hunt-evidence`);
    const result = await page.evaluate(async () => {
        const { StudentActivityWordHunt } = await import('/js/student/studentActivityWordHuntMethods.js');
        const { imageDB } = await import('/js/db.js');
        const { dataUrlToBlob } = await import('/js/imageUtils.js');
        for (const input of ['data:image/png;base64,iVBORw0KGgo=', 'data:image/png;base64,iVBORw0KGgo',
            'data:image/png;base64,iVBORw0K%20Ggo%3D', 'data:image/png;base64, iVBORw0K Ggo= ',
            'data:image/png;base64,aG V s bG8', 'data:text/plain,raw\tTAB\nLF', 'data:text/plain,%GG%2%23literal', 'data:application/octet-stream,%89PNG%00,%FF',
            'data:image/svg+xml,%3Csvg%3E%F0%9F%93%98%3C%2Fsvg%3E', 'data:text/plain,raw 📘,comma?query',
            'data:;charset=UTF-8,hello', 'data:,hello#fragment']) {
            const expected = await (await fetch(input)).blob(), actual = await dataUrlToBlob(input);
            if (actual.type !== expected.type || String(new Uint8Array(await actual.arrayBuffer())) !== String(new Uint8Array(await expected.arrayBuffer()))) throw new Error(`Local data URL decoding differs from browser fetch for ${input.split(',')[0]}: actual=${actual.type}, expected=${expected.type}, actualBytes=${String(new Uint8Array(await actual.arrayBuffer()))}, expectedBytes=${String(new Uint8Array(await expected.arrayBuffer()))}`);
        }
        const { StudentActivityProgressFlow } = await import('/js/student/studentActivityProgressFlowMethods.js');
        const { supabaseService } = await import('/js/supabaseService.js');
        const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
        const writes = [];
        imageDB.saveDrawing = async (...args) => writes.push(['drawing', args[0], args[3].ownerUserId, args[2].type]);
        supabaseService.uploadWordHuntImage = async ({ path }) => { writes.push(['upload', path]); return path; };
        const fixture = () => {
            const unit = { images: { Pixel: dataUrl }, wordHunt: { Pixel: { definition: 'Keep writing' } } };
            const sm = { authDisabled: false, currentUser: { uid: '11111111-1111-4111-8111-111111111111' }, currentVocab: { id: 'A', assignmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
                progress: { cloud: { cloudGeneration: 1 }, saveLocalProgress() {} } };
            const activities = { sm, session: { vocabularyLoadId: 1 }, progressPersistence: { runtimeGeneration: 0 }, getUnitProgressKey: vocab => vocab.id,
                progressFlow: { getCurrentUnitProgress: () => unit } };
            sm.getVocabRouteId = vocab => vocab.id;
            sm.studentProfile = { grade: '6' };
            sm.progressData = { units: { [`assignment:${sm.currentVocab.assignmentId}`]: unit } };
            activities.getUnitProgressKey = vocab => `assignment:${vocab.assignmentId}`;
            activities.schedule = { getVocabTrimesterKey: () => 'IIIT' };
            activities.progressFlow = new StudentActivityProgressFlow(activities);
            return { sm, unit, evidence: new StudentActivityWordHunt(activities) };
        };
        let release, entered;
        const held = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
        const realEncode = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function(callback, ...args) { return realEncode.call(this, blob => { entered(); held.then(() => callback(blob)); }, ...args); };
        const old = fixture(), operation = old.evidence.migrateLegacyWordHuntImages();
        await started;
        old.sm.currentUser = { uid: '22222222-2222-4222-8222-222222222222' };
        release(); await operation; HTMLCanvasElement.prototype.toBlob = realEncode;
        const stale = { writes: writes.length, legacy: old.unit.images.Pixel === dataUrl, entry: old.unit.wordHunt.Pixel };
        const normal = fixture();
        await normal.evidence.migrateLegacyWordHuntImages();
        return { stale, normal: { writes, legacy: Boolean(normal.unit.images.Pixel), entry: normal.unit.wordHunt.Pixel } };
    });
    assert.deepEqual(result.stale, { writes: 0, legacy: true, entry: { definition: 'Keep writing' } });
    assert.equal(result.normal.writes.length, 2);
    assert.equal(result.normal.writes[0][3], 'image/webp');
    assert.equal(result.normal.legacy, false);
    assert.equal(result.normal.entry.definition, 'Keep writing');
    assert.equal(result.normal.entry.hasImage, true);
    assert.match(result.normal.entry.imagePath, /aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\/11111111-1111-4111-8111-111111111111\/pixel.webp/);
    assert.deepEqual(errors, []);
    console.log('Word Hunt evidence source smoke passed: held actual image processing canceled; real canvas compression and owned migration confirmed.');
} finally {
    await browser?.close();
    server?.kill();
}
