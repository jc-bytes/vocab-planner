import { mkdir, readFile, writeFile, realpath, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadVocabularyCatalogBundle, validateVocabulary } from './vocabularyCatalog.mjs';

function inside(root, file) {
    const relative = path.relative(root, file);
    return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
async function deliveryFiles(sourceRoot) {
    const { manifestBytes, records } = await loadVocabularyCatalogBundle(sourceRoot);
    const errors = records.flatMap(record => validateVocabulary(record.vocabulary, record.entry.path));
    if (errors.length) throw new Error(`Vocabulary catalog validation failed: ${errors.join('; ')}`);
    return new Map([['vocabularies/manifest.json', manifestBytes], ...records.map(record => [record.entry.path, record.sourceBytes])]);
}
async function catalogTarget(output, name, create = false) {
    const parts = name.split('/');
    let target = output;
    for (const [index, part] of parts.entries()) {
        target = path.join(target, part);
        let info;
        try { info = await lstat(target); }
        catch (error) {
            if (error.code !== 'ENOENT' || !create) throw error;
            if (index < parts.length - 1) { await mkdir(target); info = await lstat(target); }
        }
        if (info?.isFile() && info.nlink > 1) throw new Error(`Catalog output cannot overwrite a hard-linked file: ${name}`);
        if (info?.isSymbolicLink()) throw new Error(`Catalog output cannot be a symbolic link: ${name}`);
        if (index === parts.length - 1 && info && !info.isFile()) throw new Error(`Catalog output is not a regular file: ${name}`);
        if (index < parts.length - 1 && !info?.isDirectory()) throw new Error(`Catalog output parent is not a directory: ${name}`);
    }
    return target;
}
export async function copyVocabularyCatalog(sourceRoot, outputRoot) {
    const files = await deliveryFiles(sourceRoot);
    await mkdir(outputRoot, { recursive: true });
    if ((await lstat(outputRoot)).isSymbolicLink()) throw new Error('Catalog output root cannot be a symbolic link');
    const output = await realpath(outputRoot), source = await realpath(sourceRoot);
    if (output === source || inside(output, source) || output === path.join(source, 'vocabularies') || inside(path.join(source, 'vocabularies'), output)) throw new Error('Catalog output must not contain the source workspace');
    for (const [name, contents] of files) {
        await writeFile(await catalogTarget(output, name, true), contents);
    }
    await validateBuiltVocabularyCatalog(sourceRoot, outputRoot);
    return { files: files.size, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0) };
}
export async function validateBuiltVocabularyCatalog(sourceRoot, outputRoot) {
    if ((await lstat(outputRoot)).isSymbolicLink()) throw new Error('Catalog output root cannot be a symbolic link');
    const files = await deliveryFiles(sourceRoot);
    for (const [name, contents] of files) {
        const built = await readFile(await catalogTarget(outputRoot, name));
        if (!contents.equals(built)) throw new Error(`Built vocabulary bytes differ: ${name}`);
    }
    async function verifyDirectory(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const target = path.join(directory, entry.name), name = path.relative(outputRoot, target).split(path.sep).join('/');
            if (entry.isSymbolicLink()) throw new Error(`Built catalog contains a symbolic link: ${name}`);
            if (entry.isDirectory()) await verifyDirectory(target);
            else if (!files.has(name)) throw new Error(`Built catalog contains an unlisted file: ${name}`);
        }
    }
    await verifyDirectory(path.join(outputRoot, 'vocabularies'));
    return files.size;
}
