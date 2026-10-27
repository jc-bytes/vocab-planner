import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link, access } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ARTIFACT_IDENTITY_FILE, fingerprintBuildInputs, fingerprintPublicBuildConfig,
    stampBuildArtifact, verifyBuildArtifact, removeBuildArtifactIdentity,
    verifyOwnedVitePreviewArtifact } from '../scripts/lib/buildArtifactIdentity.mjs';
import { buildWeb, WEB_BUILD_STEPS } from '../scripts/build-web.mjs';

const rootFiles = ['index.html', 'student.html', 'student-preview.html', 'teacher.html', 'favicon.ico',
    'logo.jpeg', 'student-sw.js', 'package-lock.json', 'vite.config.mjs'];
const buildFiles = ['build-web.mjs', 'copy-desktop-assets.mjs', 'validate-built-vocabulary-catalog.mjs',
    'validate-game-build.mjs', 'validate-lazy-build.mjs', 'generate-service-worker.mjs', 'check-dist-size.mjs',
    'student-precache.mjs', 'lib/vocabularyCatalog.mjs', 'lib/vocabularyCatalogDelivery.mjs',
    'lib/lazyBuildContracts.mjs', 'lib/deliverySizeBudgets.mjs', 'lib/buildArtifactIdentity.mjs', 'lib/build-public-config.mjs'];

async function put(root, name, contents) {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents);
}
function cleanEnv() {
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
        if (key.startsWith('VITE_') || ['NODE_ENV', 'npm_package_version', 'MAX_DIST_BYTES',
            'ALLOW_MISSING_SUPABASE_CONFIG', 'ALLOW_PRODUCTION_SUPABASE_IN_DEV'].includes(key)) delete env[key];
    }
    return env;
}
async function fixture(t) {
    const root = await mkdtemp(path.join(tmpdir(), 'sparks-artifact-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const name of [...rootFiles, ...buildFiles.map(name => `scripts/${name}`),
        'js/app.js', 'css/app.css', 'config/public.js', 'images/logo.svg']) await put(root, name, 'fixture input');
    await put(root, 'package.json', JSON.stringify({ version: '1.2.3' }));
    const entry = { id: 'fixture', path: 'vocabularies/fixture.json' };
    await put(root, 'vocabularies/manifest.json', JSON.stringify({ vocabularies: [entry] }));
    await put(root, entry.path, JSON.stringify({ id: entry.id, words: [] }));
    const output = path.join(root, 'dist-desktop'), env = cleanEnv();
    await put(output, '.vite/manifest.json', '{}');
    await put(output, 'student.html', 'fixture output');
    await put(output, 'assets/student.js', 'compiled bytes');
    await put(output, 'student-sw.js', 'worker bytes');
    await put(output, 'js/games/retained.bin', 'legitimate copied extra asset');
    return { root, output, env };
}
async function stamp(f) {
    const before = await fingerprintBuildInputs(f.root);
    const configuration = await fingerprintPublicBuildConfig(f.root, { env: f.env });
    return stampBuildArtifact(f.root, f.output, before, configuration, { env: f.env });
}

test('stamp verifies actual input bytes and every retained output without storing contents or env values', async t => {
    const f = await fixture(t);
    await put(f.root, '.env.production', 'VITE_PUBLIC_MARKER=public-value-not-for-stamp\nPRIVATE_SECRET=private-value-not-for-stamp\n');
    const identity = await stamp(f);
    assert.ok(identity.outputs['js/games/retained.bin']);
    assert.ok(identity.outputs['.vite/manifest.json']);
    assert.ok(identity.outputs['student-sw.js']);
    assert.equal(identity.outputs[ARTIFACT_IDENTITY_FILE], undefined);
    const metadata = await readFile(path.join(f.output, ARTIFACT_IDENTITY_FILE), 'utf8');
    assert.doesNotMatch(metadata, /public-value-not-for-stamp|private-value-not-for-stamp|compiled bytes/);
    await verifyBuildArtifact(f.root, f.output, { env: f.env });
});

for (const change of ['edited', 'added', 'deleted']) test(`${change} application input invalidates retained dist`, async t => {
    const f = await fixture(t); await stamp(f);
    if (change === 'edited') await put(f.root, 'js/app.js', 'new dirty bytes');
    if (change === 'added') await put(f.root, 'js/new-module.js', 'new dirty module');
    if (change === 'deleted') await rm(path.join(f.root, 'js/app.js'));
    await assert.rejects(verifyBuildArtifact(f.root, f.output, { env: f.env }), /stale.*inputs/i);
});

test('documentation, tests, dependencies, unlisted archives and private env values do not stale runtime bytes', async t => {
    const f = await fixture(t); await stamp(f);
    for (const name of ['docs/notes.md', 'tests/probe.mjs', 'node_modules/library.js',
        'vocabularies/archive/unlisted.json', '.env.local']) {
        await put(f.root, name, name === '.env.local' ? 'PRIVATE_SECRET=changed\n' : 'not a runtime input');
    }
    await verifyBuildArtifact(f.root, f.output, { env: f.env });
});

for (const name of ['js/credentials.js', 'js/test/shared.js', 'config/secrets/runtime-config.js']) {
    test(`ordinary runtime source ${name} cannot evade the input fingerprint`, async t => {
        const f = await fixture(t); await stamp(f);
        await put(f.root, name, 'ordinary runtime bytes');
        await assert.rejects(verifyBuildArtifact(f.root, f.output, { env: f.env }), /stale.*inputs/i);
    });
}

for (const change of ['edited', 'added', 'deleted']) test(`${change} output invalidates retained dist`, async t => {
    const f = await fixture(t); await stamp(f);
    if (change === 'edited') await put(f.output, 'assets/student.js', 'tampered output');
    if (change === 'added') await put(f.output, 'assets/unrecorded.js', 'new output');
    if (change === 'deleted') await rm(path.join(f.output, 'student-sw.js'));
    await assert.rejects(verifyBuildArtifact(f.root, f.output, { env: f.env }), /files changed|incomplete/i);
});

test('public configuration follows Vite dotenv expansion and process.env precedence', async t => {
    const f = await fixture(t); f.env.VITE_OVERRIDE = 'process-wins';
    await put(f.root, '.env.production', 'VITE_OVERRIDE=file-loses\nPRIVATE_SECRET=one\n');
    const before = await fingerprintPublicBuildConfig(f.root, { env: f.env });
    await put(f.root, '.env.production', 'VITE_OVERRIDE=file-changed\nPRIVATE_SECRET=two\n');
    assert.deepEqual(await fingerprintPublicBuildConfig(f.root, { env: f.env }), before);
    f.env.VITE_OVERRIDE = 'new-process-value';
    assert.notDeepEqual(await fingerprintPublicBuildConfig(f.root, { env: f.env }), before);
    delete f.env.VITE_OVERRIDE;
    assert.notDeepEqual(await fingerprintPublicBuildConfig(f.root, { env: f.env }), before);
});

for (const change of ['source', 'dotenv']) test(`mid-build ${change} changes fail before stamping`, async t => {
    const f = await fixture(t), before = await fingerprintBuildInputs(f.root);
    const configuration = await fingerprintPublicBuildConfig(f.root, { env: f.env });
    if (change === 'source') await put(f.root, 'js/app.js', 'changed during build');
    else await put(f.root, '.env.production', 'VITE_NEW_PUBLIC_VALUE=changed\n');
    await assert.rejects(stampBuildArtifact(f.root, f.output, before, configuration, { env: f.env }), /changed while building/);
    await assert.rejects(access(path.join(f.output, ARTIFACT_IDENTITY_FILE)), { code: 'ENOENT' });
});

test('chosen source, env and output symlinks are rejected without following cycles', async t => {
    const f = await fixture(t);
    await symlink(f.root, path.join(f.root, 'js/cycle'));
    await assert.rejects(fingerprintBuildInputs(f.root), /symbolic link/);
    await rm(path.join(f.root, 'js/cycle'));
    await symlink(path.join(f.root, 'package.json'), path.join(f.root, '.env.local'));
    await assert.rejects(fingerprintPublicBuildConfig(f.root, { env: f.env }), /symbolic link/);
    await rm(path.join(f.root, '.env.local'));
    await symlink(f.root, path.join(f.output, 'cycle'));
    await assert.rejects(stamp(f), /symbolic link/);
});

test('wrapper retains sequential steps and includes stamp bytes in the unchanged final size gate', async t => {
    const f = await fixture(t), steps = [];
    await buildWeb({ root: f.root, env: f.env, runStep: async (script, args) => {
        steps.push(path.basename(script));
        if (steps.length === 1) assert.deepEqual(args, ['build', '--mode', 'production']);
        if (path.basename(script) === 'check-dist-size.mjs') await access(path.join(f.output, ARTIFACT_IDENTITY_FILE));
    } });
    assert.deepEqual(steps, ['vite.js', ...WEB_BUILD_STEPS]);
    await verifyBuildArtifact(f.root, f.output, { env: f.env });
});

test('failed final budget gate leaves no usable freshness stamp', async t => {
    const f = await fixture(t);
    await assert.rejects(buildWeb({ root: f.root, env: f.env, runStep: async script => {
        if (path.basename(script) === 'check-dist-size.mjs') throw new Error('Controlled unchanged budget failure');
    } }), /budget failure/);
    await assert.rejects(verifyBuildArtifact(f.root, f.output, { env: f.env }), /identity is missing/i);
});

test('cleanup rejects output ancestors that could point at an external identity file', async t => {
    const f = await fixture(t), outside = path.join(f.root, 'outside');
    await put(outside, 'artifact-identity.json', 'keep this external file');
    await rm(path.join(f.output, '.vite'), { recursive: true });
    await symlink(outside, path.join(f.output, '.vite'));
    await assert.rejects(removeBuildArtifactIdentity(f.output), /symbolic link/);
    assert.equal(await readFile(path.join(outside, 'artifact-identity.json'), 'utf8'), 'keep this external file');
});

test('direct stamping cannot truncate a hard-linked identity file', async t => {
    const f = await fixture(t), outside = path.join(f.root, 'notes.txt');
    await writeFile(outside, 'keep unrelated source notes');
    await link(outside, path.join(f.output, ARTIFACT_IDENTITY_FILE));
    await assert.rejects(stamp(f), /independent regular file/);
    assert.equal(await readFile(outside, 'utf8'), 'keep unrelated source notes');
});

test('owned preview verifier requires a stamp while development server arguments do not', async t => {
    const f = await fixture(t);
    await assert.rejects(verifyOwnedVitePreviewArtifact(f.root, ['preview', '--outDir', f.output]), /identity is missing/);
    assert.equal(await verifyOwnedVitePreviewArtifact(f.root, ['--host', '127.0.0.1']), undefined);
});
