import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fingerprintBuildInputs, fingerprintPublicBuildConfig, stampBuildArtifact,
    removeBuildArtifactIdentity, verifyBuildArtifact } from './lib/buildArtifactIdentity.mjs';

export const WEB_BUILD_STEPS = Object.freeze(['copy-desktop-assets.mjs', 'validate-built-vocabulary-catalog.mjs',
    'validate-game-build.mjs', 'validate-lazy-build.mjs', 'generate-service-worker.mjs', 'check-dist-size.mjs']);

async function run(script, args, cwd, env) {
    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: 'inherit' });
        child.once('error', reject);
        child.once('close', code => code === 0 ? resolve() : reject(new Error(`Build step failed (${path.basename(script)}).`)));
    });
}

export async function buildWeb({ root = process.cwd(), mode = 'production', env = process.env,
    runStep = run } = {}) {
    const output = path.join(root, 'dist-desktop');
    const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    const buildEnv = { ...env, npm_package_version: env.npm_package_version || packageJson.version || '0.1.0' };
    const before = await fingerprintBuildInputs(root);
    const configuration = await fingerprintPublicBuildConfig(root, { mode, env: buildEnv });
    await removeBuildArtifactIdentity(output);
    try {
        const require = createRequire(import.meta.url);
        const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
        await runStep(vite, ['build', '--mode', mode], root, buildEnv);
        for (const step of WEB_BUILD_STEPS) {
            // Include the metadata itself in the existing final size gate.
            if (step === 'check-dist-size.mjs') await stampBuildArtifact(root, output, before, configuration, { env: buildEnv });
            await runStep(path.join(root, 'scripts', step), [], root, buildEnv);
        }
        await verifyBuildArtifact(root, output, { mode, env: buildEnv });
    } catch (error) {
        await removeBuildArtifactIdentity(output);
        throw error;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv.length > 2) throw new Error('Usage: node scripts/build-web.mjs');
    await buildWeb();
}
