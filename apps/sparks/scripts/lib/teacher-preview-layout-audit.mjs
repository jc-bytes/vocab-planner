import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { installTeacherFeatureFixture } from './teacher-feature-fixture.mjs';
import { collectStaticDeliveryFiles } from './deliverySizeBudgets.mjs';

export const teacherPreviewLayoutWidths = [320, 323, 326, 344, 348, 355, 357, 390, 430, 760, 761, 768, 1280];

async function settle(page, frame) {
    await page.waitForLoadState('networkidle');
    await frame.evaluate(async () => {
        await document.fonts.ready;
        let timer;
        try {
            await Promise.race([Promise.all(document.getAnimations()
                .filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime))
                .map(animation => animation.finished.catch(() => {}))),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Preview layout animations did not settle')), 2000); })]);
        } finally { clearTimeout(timer); }
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}

async function measure(locator) {
    await locator.scrollIntoViewIfNeeded();
    return locator.evaluate(node => {
        const plain = rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height });
        const box = node.getBoundingClientRect();
        const within = (rect, bounds) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
            && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
        let clip = { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
        const clippingAncestors = [];
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const css = getComputedStyle(parent), rect = parent.getBoundingClientRect();
            const x = /hidden|clip|auto|scroll/.test(css.overflowX), y = /hidden|clip|auto|scroll/.test(css.overflowY);
            if (!x && !y) continue;
            const bounds = { left: rect.left + parent.clientLeft, right: rect.left + parent.clientLeft + parent.clientWidth,
                top: rect.top + parent.clientTop, bottom: rect.top + parent.clientTop + parent.clientHeight };
            if (x) { clip.left = Math.max(clip.left, bounds.left); clip.right = Math.min(clip.right, bounds.right); }
            if (y) { clip.top = Math.max(clip.top, bounds.top); clip.bottom = Math.min(clip.bottom, bounds.bottom); }
            clippingAncestors.push({ tag: parent.tagName, id: parent.id, className: parent.className, x, y, bounds });
        }
        const texts = [], walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let text;
        while ((text = walker.nextNode())) {
            if (!text.textContent.trim()) continue;
            const range = document.createRange(); range.selectNodeContents(text);
            for (const rect of range.getClientRects()) {
                if (rect.width < 1 || rect.height < 1) continue;
                const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
                texts.push({ text: text.textContent.trim(), bounds: plain(rect), inCard: within(rect, box),
                    inClip: within(rect, clip), centerHit: !!hit && node.contains(hit) });
            }
        }
        const center = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return { activity: node.dataset.activity || null, text: node.textContent.trim(), disabled: node.disabled === true,
            bounds: plain(box), clip, clippingAncestors, inClip: within(box, clip),
            centerHit: !!center && node.contains(center), texts };
    });
}

export async function auditTeacherPreviewLayout({ browser, baseUrl, manifest, outputRoot, label }) {
    await mkdir(outputRoot, { recursive: true });
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), fixture = await installTeacherFeatureFixture(page), results = [], failures = [];
    try {
        await page.goto(`${baseUrl}/teacher.html#/teacher/vocabulary`);
        await page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
        await page.evaluate(async ({ path, css }) => {
            await Promise.all(css.map(href => new Promise((resolve, reject) => {
                const absolute = new URL(href, location.href).href;
                if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === absolute && link.sheet)) return resolve();
                const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = absolute;
                const timer = setTimeout(() => reject(new Error('Preview owner CSS deadline')), 10000);
                link.onload = () => { clearTimeout(timer); resolve(); }; link.onerror = () => { clearTimeout(timer); reject(new Error('Preview owner CSS failed')); };
                document.head.append(link);
            })));
            const { previewTeacherUnit } = await import(path);
            const words = ['Network', 'Browser', 'Packet', 'Server', 'Client', 'Router', 'Website', 'Message']
                .map(word => ({ word, definition: `${word} helps computers share information.`, example: `We use a ${word.toLowerCase()} in class.`,
                    synonyms: ['Connection'], antonyms: ['Isolation'], emoji: '📘' }));
            await previewTeacherUnit(await teacherApp.getTeacherLibrary(), {
                id: 'preview-layout-fixture', name: 'Networks and reliable messages', grade: '6', words,
                activitySettings: { requiredActivities: ['flashcards', 'matching', 'fill-in-blank'], additionalActivities: ['illustration', 'quiz'] }
            }, 'local');
        }, { path: manifest ? `/${manifest['js/teacherStudentPreview.js'].file}` : '/js/teacherStudentPreview.js',
            css: manifest ? [...collectStaticDeliveryFiles(manifest, 'js/teacherStudentPreview.js')].filter(path => path.endsWith('.css')).map(path => `/${path}`) : [] });
        const handle = await page.locator('.teacher-unit-preview-frame').elementHandle(), frame = await handle.contentFrame();
        await frame.locator('#activity-menu-view:not(.hidden) .activity-card').first().waitFor();
        await page.addLocatorHandler(page.frameLocator('.teacher-unit-preview-frame').getByRole('button', { name: 'Skip guide', exact: true }), async locator => locator.click());
        await frame.evaluate(() => document.querySelectorAll('#activity-menu-view details.activity-disclosure').forEach(node => { node.open = true; }));
        const counts = await frame.evaluate(() => ({
            required: document.querySelectorAll('.required-activity-card:not([hidden])').length,
            additional: document.querySelectorAll('.additional-activity-card:not([hidden])').length,
            hiddenReference: document.querySelectorAll('.activity-unavailable-card:not([hidden])').length
        }));
        if (!counts.required || !counts.additional || !counts.hiddenReference) throw new Error(`Preview fixture must exercise all three actual card categories: ${JSON.stringify(counts)}`);
        for (const width of teacherPreviewLayoutWidths) {
            await page.setViewportSize({ width, height: 480 }); await settle(page, frame);
            const cards = frame.locator('.activity-card:not([hidden])');
            const state = { width, height: 480, iframe: await page.locator('.teacher-unit-preview-frame').boundingBox(), counts, cards: [], controls: [] };
            for (let index = 0; index < await cards.count(); index++) {
                const card = cards.nth(index);
                if (!await card.isVisible()) continue;
                const actual = await measure(card); state.cards.push(actual);
                if (!actual.inClip || !actual.centerHit || actual.texts.some(text => !text.inCard || !text.inClip || !text.centerHit)) {
                    failures.push({ width, kind: 'card', activity: actual.activity, bounds: actual.bounds, clip: actual.clip,
                        centerHit: actual.centerHit, clippedText: actual.texts.filter(text => !text.inCard || !text.inClip || !text.centerHit) });
                }
            }
            await cards.first().scrollIntoViewIfNeeded();
            await page.locator('.teacher-unit-preview-frame').screenshot({ path: join(outputRoot, `${label}-${width}.png`) });
            for (const selector of ['#back-to-vocab', '#student-vocab-export-menu > summary']) {
                const control = frame.locator(selector);
                const actual = await measure(control); state.controls.push({ selector, ...actual });
                if (!actual.inClip || !actual.centerHit || actual.texts.some(text => !text.inClip)) failures.push({ width, kind: 'control', selector, ...actual });
            }
            const exportTrigger = frame.locator('#student-vocab-export-menu > summary');
            await exportTrigger.click();
            for (const selector of ['#download-word-hunt-btn', '#generate-final-report-btn']) {
                const actual = await measure(frame.locator(selector)); state.controls.push({ selector, ...actual });
                if (!actual.inClip || !actual.centerHit || actual.texts.some(text => !text.inClip)) failures.push({ width, kind: 'control', selector, ...actual });
            }
            await page.locator('.teacher-unit-preview-frame').screenshot({ path: join(outputRoot, `${label}-${width}-export.png`) });
            await exportTrigger.click();
            results.push(state); console.log(`${label} ${width}px: ${state.cards.length} cards measured; ${failures.filter(item => item.width === width).length} visibility failures.`);
        }
        await page.setViewportSize({ width: 320, height: 480 }); await settle(page, frame);
        await frame.locator('#student-vocab-export-menu > summary').click();
        const download = page.waitForEvent('download');
        await frame.locator('#generate-final-report-btn').click();
        const pdf = await download, stream = await pdf.createReadStream(), chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const bytes = Buffer.concat(chunks);
        if (!pdf.suggestedFilename().endsWith('.pdf') || bytes.length < 1000 || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('The reachable preview Final Report control must produce a real PDF');
        await frame.locator('#student-vocab-export-menu > summary').click();
        await frame.locator('#back-to-vocab').click();
        await page.locator('.teacher-unit-preview-frame').waitFor({ state: 'detached' });
        if (fixture.errors.length) throw new Error(`Preview emitted page errors: ${fixture.errors.join('; ')}`);
        await writeFile(join(outputRoot, `${label}-results.json`), `${JSON.stringify({ label, results, failures, functionalControls: { pdfBytes: bytes.length, backClosedPreview: true } }, null, 2)}\n`);
        return { results, failures };
    } finally { await context.close(); }
}
