import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { ARTIFACT_IDENTITY_FILE, fingerprintBuildOutput } from './buildArtifactIdentity.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export async function getHistoricalBuildIdentity(root) {
    const bytes = await readFile(join(root, ARTIFACT_IDENTITY_FILE));
    const official = JSON.parse(bytes);
    if (official.version !== 1 || !/^[a-f0-9]{64}$/.test(official.inputs?.digest)
        || !/^[a-f0-9]{64}$/.test(official.configuration?.digest)) throw new Error('Historical reference needs an official build identity.');
    const outputs = await fingerprintBuildOutput(root); // Intentionally excludes the stamp itself.
    if (JSON.stringify(outputs) !== JSON.stringify(official.outputs)) throw new Error('Historical output does not match its official build stamp.');
    return { stampSha256: sha256(bytes), outputDigest: sha256(JSON.stringify(outputs)),
        originalInputDigest: official.inputs.digest, originalPublicConfigurationDigest: official.configuration.digest };
}
async function inventory(root, relative = '') {
    const result = [];
    if (!(await lstat(root)).isDirectory() || (await lstat(root)).isSymbolicLink()) throw new Error('Reference root must be a regular directory.');
    for (const name of (await readdir(join(root, relative))).sort()) {
        const path = relative ? `${relative}/${name}` : name, absolute = join(root, path), stat = await lstat(absolute);
        if (stat.isSymbolicLink()) throw new Error(`Reference symlink refused: ${path}`);
        if (stat.isDirectory()) result.push(...await inventory(root, path));
        else if (stat.isFile()) { const bytes = await readFile(absolute); result.push({ path, size: bytes.length, sha256: sha256(bytes) }); }
        else throw new Error(`Reference contains a non-file: ${path}`);
    }
    return result;
}

// A historical reference is deliberately independent of current-source freshness.
// It must instead match the exact copied output identity recorded at capture.
export async function capturePresentationReference(source, reference) {
    const officialBuild = await getHistoricalBuildIdentity(source);
    const destination = resolve(reference);
    if (!destination.startsWith(`${resolve(tmpdir())}${sep}`) && !destination.startsWith('/tmp/')) throw new Error('Historical references belong in the temporary directory.');
    const sourcePath = await realpath(source), destinationPath = join(await realpath(dirname(destination)), basename(destination));
    if (destinationPath === sourcePath || destinationPath.startsWith(`${sourcePath}${sep}`)
        || sourcePath.startsWith(`${destinationPath}${sep}`)) throw new Error('Historical reference cannot overlap its source artifact.');
    await mkdir(destination); // Refuse accidental overwrite of any prior reference.
    const outputs = await inventory(source), artifact = join(destination, 'artifact');
    for (const item of outputs) {
        const target = join(artifact, item.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, await readFile(join(source, item.path)), { flag: 'wx' });
    }
    const identity = { kind: 'historical-presentation-reference-v1', capturedAt: new Date().toISOString(),
        outputIdentity: sha256(JSON.stringify(outputs)), officialBuild, outputs };
    await writeFile(join(destination, 'identity.json'), `${JSON.stringify(identity, null, 2)}\n`, { flag: 'wx' });
    await verifyPresentationReference(destination);
    return identity;
}
export async function verifyPresentationReference(reference) {
    const identity = JSON.parse(await readFile(join(reference, 'identity.json'), 'utf8'));
    if (identity.kind !== 'historical-presentation-reference-v1' || !Array.isArray(identity.outputs)
        || sha256(JSON.stringify(identity.outputs)) !== identity.outputIdentity) throw new Error('Invalid historical reference identity.');
    const actual = await inventory(join(reference, 'artifact'));
    if (JSON.stringify(actual) !== JSON.stringify(identity.outputs)) throw new Error('Historical reference output bytes changed.');
    const officialBuild = await getHistoricalBuildIdentity(join(reference, 'artifact'));
    if (JSON.stringify(officialBuild) !== JSON.stringify(identity.officialBuild)) throw new Error('Historical official build identity changed.');
    return identity;
}
export async function servePresentationReference(reference) {
    await verifyPresentationReference(reference);
    const root = resolve(reference, 'artifact');
    const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png',
        jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', ico: 'image/x-icon' };
    const server = createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
            const target = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
            if (!target.startsWith(`${root}${sep}`) || !(await lstat(target)).isFile() || (await lstat(target)).isSymbolicLink()) throw new Error('Missing reference output.');
            response.writeHead(200, { 'content-type': types[target.split('.').at(-1)] || 'application/octet-stream', 'cache-control': 'no-store' });
            response.end(await readFile(target));
        } catch { response.writeHead(404); response.end('Historical reference output not found.'); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
