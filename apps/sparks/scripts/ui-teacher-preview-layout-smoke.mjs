import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { auditTeacherPreviewLayout } from './lib/teacher-preview-layout-audit.mjs';

const port = Number(process.env.UI_TEACHER_PREVIEW_LAYOUT_PORT || 19885), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_PREVIEW_LAYOUT_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
let browser, server;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    const result = await auditTeacherPreviewLayout({ browser, baseUrl, manifest,
        outputRoot: join(tmpdir(), 'sparks-teacher-preview-layout'), label: built ? 'built' : 'source' });
    assert.deepEqual(result.failures, [], 'All preview card text and controls must fit and remain reachable; inspect /tmp/sparks-teacher-preview-layout evidence.');
} finally { await browser?.close(); server?.kill(); }
