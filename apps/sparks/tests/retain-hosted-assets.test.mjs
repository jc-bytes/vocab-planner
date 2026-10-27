import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruneCandidateAssets, retainHostedAssets } from '../scripts/retain-hosted-assets.mjs';

test('live graph retains published lazy chunks, preview and CSS assets without overwriting new files', async () => {
  const files = {
    '/app/index.html': '<script src="./assets/main-ABCDEFGH.js"></script>',
    '/app/student.html': '<script src="./assets/main-ABCDEFGH.js"></script>',
    '/app/teacher.html': '<script src="./assets/main-ABCDEFGH.js"></script>',
    '/app/student-preview.html': '<script src="./assets/preview-PREVIEW1.js"></script>',
    '/app/assets/preview-PREVIEW1.js': 'export const preview=true;',
    '/app/student-sw.js': 'precache([{url:"assets/optional-IJKLMNOP.js"}]);',
    '/app/assets/main-ABCDEFGH.js': 'import "./shared-QRSTUVWX.js"; import("./lazy-ZYXWVUTS.js"); const css="assets/theme-ABCDEF12.css";',
    '/app/assets/shared-QRSTUVWX.js': 'old shared code',
    '/app/assets/lazy-ZYXWVUTS.js': 'const external="https://example.invalid/assets/external-12345678.js";const outside="../../private-12345678.js";const game="js/games/flappy-bird-sprites/yellowbird-downflap.png";',
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
    await assert.rejects(readFile(join(output, '.vite/manifest.json')), { code: 'ENOENT' },
      'Packaged promotion must refresh the hosted graph without hidden build metadata');
    const result = await retainHostedAssets(`http://127.0.0.1:${server.address().port}/app/`, output);
    assert.equal(result.copied, 6);
    assert.equal(await readFile(join(output, 'assets/preview-PREVIEW1.js'), 'utf8'), 'export const preview=true;');
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

test('A to B to C retains only candidate and live generations, including a manifest-only preview entry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sparks-generations-'));
  const files = {}, requested = [];
  const server = createServer((request, response) => {
    requested.push(request.url);
    response.statusCode = Object.hasOwn(files, request.url) ? 200 : 404;
    response.end(files[request.url] || 'missing');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const main = generation => `main-${generation.repeat(8)}.js`;
  const preview = generation => `preview-${generation.repeat(8)}.js`;
  function publish(generation) {
    for (const page of ['index.html', 'student.html', 'teacher.html']) files[`/app/${page}`] = `<script src="./assets/${main(generation)}"></script>`;
    files['/app/student-sw.js'] = '/* no optional assets */';
    // Model the older deployment without a separate preview page.
    files[`/app/assets/${main(generation)}`] = `export const release="${generation}";`;
  }
  async function candidate(generation) {
    const output = join(root, generation);
    await mkdir(join(output, 'assets'), { recursive: true });
    await mkdir(join(output, '.vite'));
    await writeFile(join(output, '.vite/manifest.json'), JSON.stringify({
      'student.html': { file: `assets/${main(generation)}`, isEntry: true },
      'student-preview.html': { file: `assets/${preview(generation)}`, isEntry: true }
    }));
    await writeFile(join(output, 'assets', main(generation)), `export const release="${generation}";`);
    await writeFile(join(output, 'assets', preview(generation)), 'preview entry');
    await writeFile(join(output, 'assets', main('A')), 'inherited artifact orphan');
    await writeFile(join(output, 'assets', main('D')), 'unpublished validation-only build');
    await writeFile(join(output, 'assets', 'game-sprite.png'), 'nonhashed asset');
    await pruneCandidateAssets(output);
    await retainHostedAssets(`http://127.0.0.1:${server.address().port}/app/`, output);
    return output;
  }
  try {
    publish('A');
    files['/app/assets/orphan-ORPHAN12.js'] = 'unreferenced hosted orphan';
    const b = await candidate('B');
    assert.deepEqual((await readdir(join(b, 'assets'))).sort(), [main('A'), main('B'), preview('B'), 'game-sprite.png'].sort());
    for (const name of await readdir(join(b, 'assets'))) files[`/app/assets/${name}`] = await readFile(join(b, 'assets', name));
    publish('B');
    const c = await candidate('C');
    assert.deepEqual((await readdir(join(c, 'assets'))).sort(), [main('B'), main('C'), preview('C'), 'game-sprite.png'].sort());
    assert.ok(!requested.includes('/app/assets/orphan-ORPHAN12.js'));
    assert.ok(!requested.includes(`/app/assets/${main('D')}`));
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('both release paths retain the actual hosted graph without selecting previous workflow artifacts', async () => {
  const root = new URL('../../../.github/workflows/', import.meta.url);
  for (const name of ['static.yml', 'promote-sparks-release.yml']) {
    const source = await readFile(new URL(name, root), 'utf8');
    const retention = source.split(/- name: Retain [^\n]+\n/)[1]?.split(/\n      - name:/)[0];
    assert.ok(retention, `${name} must run hosted retention`);
    if (name === 'static.yml') {
      assert.match(retention, /node scripts\/retain-hosted-assets\.mjs "https:\/\/\$\{GITHUB_REPOSITORY_OWNER\}\.github\.io\/\$\{GITHUB_REPOSITORY#\*\/\}\/"/);
    } else {
      assert.match(retention, /import \{ retainHostedAssets \} from '\.\/apps\/sparks\/scripts\/retain-hosted-assets\.mjs'/);
      assert.match(retention, /process\.env\.GITHUB_REPOSITORY\.split\('\/'\)\[1\]/);
      assert.match(retention, /await retainHostedAssets\(`https:\/\/\$\{process\.env\.GITHUB_REPOSITORY_OWNER\}\.github\.io\/\$\{repository\}\/`, 'validated-site'\)/);
      assert.doesNotMatch(retention, /pruneCandidateAssets|node apps\/sparks\/scripts\/retain-hosted-assets\.mjs/,
        'Promotion refreshes the packaged artifact without manifest-based pruning');
    }
    assert.doesNotMatch(retention, /gh run (?:list|download)|previous_run|rsync|cp -Rn/);
    assert.match(retention, name === 'static.yml' ? /check-dist-size\.mjs/ : /30 \* 1024 \* 1024/);
    if (name === 'promote-sparks-release.yml') {
      assert.match(source, /\.conclusion == "success" and \.path == "\.github\/workflows\/static.yml"/);
      assert.match(source, /cmp "\$source_sha.json" "\$GITHUB_SHA.json"/);
    }
  }
});
