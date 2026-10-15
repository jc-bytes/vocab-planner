import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { retainHostedAssets } from '../scripts/retain-hosted-assets.mjs';

test('expired-artifact fallback retains published lazy chunks and CSS assets without overwriting new files', async () => {
  const files = {
    '/app/index.html': '<script src="./assets/main-ABCDEFGH.js"></script>',
    '/app/student.html': '<script src="./assets/main-ABCDEFGH.js"></script>',
    '/app/teacher.html': '<script src="./assets/main-ABCDEFGH.js"></script>',
    '/app/student-sw.js': 'precache([{url:"assets/optional-IJKLMNOP.js"}]);',
    '/app/assets/main-ABCDEFGH.js': 'import "./shared-QRSTUVWX.js"; import("./lazy-ZYXWVUTS.js"); const css="assets/theme-ABCDEF12.css";',
    '/app/assets/shared-QRSTUVWX.js': 'old shared code',
    '/app/assets/lazy-ZYXWVUTS.js': 'const external="https://example.invalid/assets/external-12345678.js";const outside="../../private-12345678.js";',
    '/app/assets/optional-IJKLMNOP.js': 'export const optional=true;',
    '/app/assets/theme-ABCDEF12.css': '@font-face{src:url(./font-ABCDEFG1.woff2)}',
    '/app/assets/font-ABCDEFG1.woff2': 'font bytes'
  };
  const requested = [];
  const server = createServer((request, response) => {
    requested.push(request.url);
    response.statusCode = Object.hasOwn(files, request.url) ? 200 : 404;
    response.end(files[request.url] || 'missing');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const output = await mkdtemp(join(tmpdir(), 'sparks-retention-test-'));
  try {
    await mkdir(join(output, 'assets'));
    await writeFile(join(output, 'assets/shared-QRSTUVWX.js'), 'current shared code');
    const result = await retainHostedAssets(`http://127.0.0.1:${server.address().port}/app/`, output);
    assert.equal(result.copied, 5);
    assert.equal(await readFile(join(output, 'assets/shared-QRSTUVWX.js'), 'utf8'), 'current shared code');
    assert.equal(await readFile(join(output, 'assets/lazy-ZYXWVUTS.js'), 'utf8'), files['/app/assets/lazy-ZYXWVUTS.js']);
    assert.equal(await readFile(join(output, 'assets/font-ABCDEFG1.woff2'), 'utf8'), 'font bytes');
    assert.ok(requested.every(path => Object.hasOwn(files, path)));
    delete files['/app/index.html'];
    await assert.rejects(retainHostedAssets(`http://127.0.0.1:${server.address().port}/app/`, output), /HTTP 404/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(output, { recursive: true, force: true });
  }
});
