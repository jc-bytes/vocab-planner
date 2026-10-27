import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVocabularyCatalogBundle } from './vocabularyCatalog.mjs';

export const ARTIFACT_IDENTITY_FILE = '.vite/artifact-identity.json';
const VERSION = 1;
const ROOT_FILES = ['index.html', 'student.html', 'student-preview.html', 'teacher.html',
    'favicon.ico', 'logo.jpeg', 'student-sw.js', 'package.json', 'package-lock.json', 'vite.config.mjs'];
const BUILD_FILES = ['scripts/build-web.mjs', 'scripts/copy-desktop-assets.mjs',
    'scripts/validate-built-vocabulary-catalog.mjs', 'scripts/validate-game-build.mjs',
    'scripts/validate-lazy-build.mjs', 'scripts/generate-service-worker.mjs',
    'scripts/check-dist-size.mjs', 'scripts/student-precache.mjs',
    'scripts/lib/vocabularyCatalog.mjs', 'scripts/lib/vocabularyCatalogDelivery.mjs',
    'scripts/lib/lazyBuildContracts.mjs', 'scripts/lib/deliverySizeBudgets.mjs',
    'scripts/lib/buildArtifactIdentity.mjs', 'scripts/lib/build-public-config.mjs'];
// Root docs/tests/dist are outside the chosen input roots. Names inside app
// roots are not a reason to skip runtime code (e.g. credentials.js or test/).
const OMIT = new Set(['node_modules', '.git', '.DS_Store']);
const secretName = name => name.startsWith('.env') || /\.(?:pem|key|p12|pfx)$/i.test(name);
const digest = value => createHash('sha256').update(value).digest('hex');
const posix = name => name.split(path.sep).join('/');

async function guardIdentityPath(outputRoot) {
    for (const name of ['', '.vite', ARTIFACT_IDENTITY_FILE]) {
        let info;
        try { info = await lstat(path.join(outputRoot, name)); }
        catch (error) { if (error.code === 'ENOENT') return; throw error; }
        if (info.isSymbolicLink()) throw new Error('Artifact identity cannot follow output symbolic links.');
        if (name === ARTIFACT_IDENTITY_FILE && (!info.isFile() || info.nlink > 1)) {
            throw new Error('Artifact identity must be an independent regular file.');
        }
        if (name !== ARTIFACT_IDENTITY_FILE && !info.isDirectory()) throw new Error('Artifact output must be a directory.');
    }
}

async function regularFiles(root, directory, { inputs = false } = {}) {
    const files = [];
    async function visit(relative) {
        if (inputs && relative.split(path.sep).some(part => OMIT.has(part) || secretName(part))) return;
        const full = path.join(root, relative);
        let info;
        try { info = await lstat(full); }
        catch (error) { if (inputs && error.code === 'ENOENT') return; throw error; }
        if (info.isSymbolicLink()) throw new Error(`Artifact identity cannot follow a symbolic link: ${posix(relative)}`);
        if (info.isDirectory()) {
            for (const name of (await readdir(full)).sort()) await visit(path.join(relative, name));
        } else if (info.isFile()) files.push(posix(relative));
        else throw new Error(`Artifact identity requires regular files: ${posix(relative)}`);
    }
    await visit(directory);
    return files;
}

async function hashes(root, names) {
    const result = {};
    for (const name of [...new Set(names)].sort()) {
        let target = root;
        for (const part of name.split('/')) {
            target = path.join(target, part);
            if ((await lstat(target)).isSymbolicLink()) throw new Error(`Artifact identity cannot follow a symbolic link: ${name}`);
        }
        if (!(await lstat(target)).isFile()) throw new Error(`Artifact identity requires a regular file: ${name}`);
        result[name] = digest(await readFile(target));
    }
    return result;
}

export async function fingerprintBuildInputs(root) {
    if ((await lstat(root)).isSymbolicLink()) throw new Error('Artifact input root cannot be a symbolic link.');
    const names = [...ROOT_FILES, ...BUILD_FILES];
    for (const directory of ['js', 'css', 'config', 'images']) {
        names.push(...await regularFiles(root, directory, { inputs: true }));
    }
    const catalog = await loadVocabularyCatalogBundle(root);
    names.push('vocabularies/manifest.json', ...catalog.records.map(record => record.entry.path));
    // A deleted required root/build file is a changed input, not an ignored one.
    const files = await hashes(root, names);
    return { digest: digest(JSON.stringify(files)), files };
}

export async function fingerprintPublicBuildConfig(root, { mode = 'production', env = process.env } = {}) {
    if (path.basename(mode) !== mode || mode.includes('\\') || ['.', '..'].includes(mode)) throw new Error('Invalid Vite build mode.');
    for (const name of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
        try {
            if ((await lstat(path.join(root, name))).isSymbolicLink()) throw new Error('Build environment files cannot be symbolic links.');
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [fileURLToPath(new URL('./build-public-config.mjs', import.meta.url)), root, mode], {
            env: { ...env, DEBUG: '' }, stdio: ['ignore', 'pipe', 'pipe']
        });
        let output = '';
        child.stdout.on('data', chunk => { if (output.length < 1024) output += chunk; });
        child.stderr.resume();
        child.once('error', () => reject(new Error('Could not fingerprint public Vite build configuration.')));
        child.once('close', code => {
            if (code !== 0 || !/^[a-f0-9]{64}$/.test(output)) {
                reject(new Error('Could not fingerprint public Vite build configuration.'));
            } else resolve({ mode, digest: output });
        });
    });
}

export async function fingerprintBuildOutput(outputRoot) {
    if ((await lstat(outputRoot)).isSymbolicLink()) throw new Error('Artifact output root cannot be a symbolic link.');
    const names = (await regularFiles(outputRoot, '')).filter(name => name !== ARTIFACT_IDENTITY_FILE);
    return hashes(outputRoot, names);
}

export async function stampBuildArtifact(root, outputRoot, before, configuration, options = {}) {
    const after = await fingerprintBuildInputs(root);
    const currentConfiguration = await fingerprintPublicBuildConfig(root, { ...options, mode: configuration.mode });
    if (before.digest !== after.digest || configuration.digest !== currentConfiguration.digest) {
        throw new Error('Build inputs changed while building. Build again from stable files.');
    }
    const identity = { version: VERSION, inputs: after, configuration,
        outputs: await fingerprintBuildOutput(outputRoot) };
    const target = path.join(outputRoot, ARTIFACT_IDENTITY_FILE);
    await guardIdentityPath(outputRoot);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(identity, null, 2)}\n`);
    return identity;
}

export async function removeBuildArtifactIdentity(outputRoot) {
    await guardIdentityPath(outputRoot);
    await rm(path.join(outputRoot, ARTIFACT_IDENTITY_FILE), { force: true });
}

export async function verifyBuildArtifact(root, outputRoot, options = {}) {
    await guardIdentityPath(outputRoot);
    let identity;
    try { identity = JSON.parse(await readFile(path.join(outputRoot, ARTIFACT_IDENTITY_FILE), 'utf8')); }
    catch { throw new Error('Build identity is missing or invalid. Run npm run desktop:build:web before using built UI.'); }
    if (identity?.version !== VERSION) throw new Error('Build identity version changed. Rebuild the UI.');
    const inputs = await fingerprintBuildInputs(root);
    if (identity.inputs?.digest !== inputs.digest) throw new Error('Built UI is stale: application or build inputs changed. Rebuild the UI.');
    const configuration = await fingerprintPublicBuildConfig(root, options);
    if (identity.configuration?.mode !== configuration.mode || identity.configuration?.digest !== configuration.digest) {
        throw new Error('Built UI is stale: public build configuration changed. Rebuild the UI.');
    }
    const outputs = await fingerprintBuildOutput(outputRoot);
    if (JSON.stringify(identity.outputs) !== JSON.stringify(outputs)) throw new Error('Built UI files changed or are incomplete. Rebuild the UI.');
    return identity;
}

// Kept separate until the build command and owned-preview boundary are switched
// together. Explicit external servers make no claim about this local artifact.
export async function verifyOwnedVitePreviewArtifact(root, args) {
    if (args[0] !== 'preview') return;
    const flag = name => {
        const index = args.indexOf(name);
        return index >= 0 ? args[index + 1] : args.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
    };
    return verifyBuildArtifact(root, path.resolve(root, flag('--outDir') || 'dist-desktop'), {
        mode: flag('--mode') || 'production'
    });
}
