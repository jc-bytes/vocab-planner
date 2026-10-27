import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, readdir, link } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { copyVocabularyCatalog, validateBuiltVocabularyCatalog } from '../scripts/lib/vocabularyCatalogDelivery.mjs';
async function fixture(t) {
    const root = await mkdtemp(path.join(tmpdir(), 'sparks-catalog-delivery-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const source = path.join(root, 'source'), output = path.join(root, 'build');
    await mkdir(path.join(source, 'vocabularies', 'grade6'), { recursive: true });
    const entry = { id: 'fixture', path: 'vocabularies/grade6/fixture.json', name: 'Fixture' };
    const vocabulary = { id: 'fixture', name: 'Fixture', month: 'October', week: 1,
        words: [{ word: 'Source', definition: 'Where information starts.' }],
        activitySettings: { requiredActivities: ['flashcards'], additionalActivities: [] } };
    const manifest = path.join(source, 'vocabularies', 'manifest.json'), file = path.join(source, entry.path);
    await writeFile(manifest, JSON.stringify({ vocabularies: [entry] }, null, 3) + '\n\n');
    await writeFile(file, JSON.stringify(vocabulary, null, 4) + '\n');
    return { root, source, output, entry, vocabulary, manifest, file };
}
test('delivery copies exact manifest/registered bytes, including retired entries, without archive traversal', async t => {
    const f = await fixture(t), retired = { ...f.vocabulary, id: 'retired', activitySettings: { ...f.vocabulary.activitySettings, retiredWeeklySet: true } };
    const second = { id: retired.id, path: 'vocabularies/grade6/retired.json' };
    await writeFile(f.manifest, JSON.stringify({ vocabularies: [f.entry, second] }, null, 3) + '\n');
    await writeFile(path.join(f.source, second.path), JSON.stringify(retired));
    await writeFile(path.join(f.source, 'vocabularies', 'unlisted-private.json'), '{"never":"copy"}');
    assert.equal((await copyVocabularyCatalog(f.source, f.output)).files, 3);
    for (const name of ['vocabularies/manifest.json', f.entry.path, second.path]) {
        assert.deepEqual(await readFile(path.join(f.output, name)), await readFile(path.join(f.source, name)));
    }
    assert.deepEqual((await readdir(path.join(f.output, 'vocabularies'))).sort(), ['grade6', 'manifest.json']);
    assert.equal(await validateBuiltVocabularyCatalog(f.source, f.output), 3);
});
for (const invalid of ['../outside.json', '/tmp/outside.json', 'vocabularies/../outside.json', 'vocabularies/%2e%2e/outside.json', 'vocabularies\\outside.json', 'https://example.com/file.json']) {
    test(`delivery fails closed for unsafe reference ${invalid}`, async t => {
        const f = await fixture(t);
        await writeFile(f.manifest, JSON.stringify({ vocabularies: [{ ...f.entry, path: invalid }] }));
        await assert.rejects(copyVocabularyCatalog(f.source, f.output), /path.*invalid|outside/i);
    });
}
for (const fault of ['missing', 'mismatch', 'duplicate-id', 'duplicate-path', 'malformed']) test(`delivery rejects ${fault} catalog`, async t => {
    const f = await fixture(t);
    if (fault === 'missing') await rm(f.file);
    if (fault === 'mismatch') await writeFile(f.file, JSON.stringify({ ...f.vocabulary, id: 'wrong' }));
    if (fault === 'duplicate-id') await writeFile(f.manifest, JSON.stringify({ vocabularies: [f.entry, f.entry] }));
    if (fault === 'duplicate-path') await writeFile(f.manifest, JSON.stringify({ vocabularies: [f.entry, { ...f.entry, id: 'other' }] }));
    if (fault === 'malformed') await writeFile(f.manifest, '{}');
    await assert.rejects(copyVocabularyCatalog(f.source, f.output));
});
test('source symlinks cannot escape the catalog', async t => {
    const f = await fixture(t), outside = path.join(f.root, 'outside.json');
    await writeFile(outside, JSON.stringify(f.vocabulary)); await rm(f.file); await symlink(outside, f.file);
    await assert.rejects(copyVocabularyCatalog(f.source, f.output), /outside|symbolic link/);
});
test('output symlinks cannot create files or directories outside the build', async t => {
    const f = await fixture(t), outside = path.join(f.root, 'outside');
    await mkdir(outside); await mkdir(f.output); await symlink(outside, path.join(f.output, 'vocabularies'));
    await assert.rejects(copyVocabularyCatalog(f.source, f.output), /symbolic link/);
    assert.deepEqual(await readdir(outside), []);
});
test('built validation catches missing, modified and unlisted files', async t => {
    const f = await fixture(t); await copyVocabularyCatalog(f.source, f.output);
    const target = path.join(f.output, f.entry.path);
    await writeFile(target, '{}'); await assert.rejects(validateBuiltVocabularyCatalog(f.source, f.output), /bytes differ/);
    await rm(target); await assert.rejects(validateBuiltVocabularyCatalog(f.source, f.output), { code: 'ENOENT' });
    await copyVocabularyCatalog(f.source, f.output);
    await writeFile(path.join(f.output, 'vocabularies', 'unlisted.json'), '{}');
    await assert.rejects(validateBuiltVocabularyCatalog(f.source, f.output), /unlisted/);
});

test('catalog cannot overwrite its source workspace or catalog directory', async t => {
    const f = await fixture(t), original = await readFile(f.file);
    await assert.rejects(copyVocabularyCatalog(f.source, f.source), /must not contain/);
    await assert.rejects(copyVocabularyCatalog(f.source, path.join(f.source, 'vocabularies')), /must not contain/);
    assert.deepEqual(await readFile(f.file), original);
});

test('an output root symlink is rejected before copying', async t => {
    const f = await fixture(t), outside = path.join(f.root, 'outside');
    await mkdir(outside); await symlink(outside, f.output);
    await assert.rejects(copyVocabularyCatalog(f.source, f.output), /symbolic link/);
    assert.deepEqual(await readdir(outside), []);
});


test('standalone validator rejects an output root symlink', async t => {
    const f = await fixture(t); await copyVocabularyCatalog(f.source, f.output);
    const alias = path.join(f.root, 'alias'); await symlink(f.output, alias);
    await assert.rejects(validateBuiltVocabularyCatalog(f.source, alias), /symbolic link/);
});

test('copy never truncates an existing hard-linked output file or its unrelated source', async t => {
    const f = await fixture(t), notes = path.join(f.source, 'notes.txt');
    await writeFile(notes, 'Preserve these unrelated source notes.');
    await mkdir(path.dirname(path.join(f.output, f.entry.path)), { recursive: true });
    await link(notes, path.join(f.output, f.entry.path));
    await assert.rejects(copyVocabularyCatalog(f.source, f.output), /hard-linked/);
    assert.equal(await readFile(notes, 'utf8'), 'Preserve these unrelated source notes.');
});


test('manifest cannot list itself as a vocabulary material', async t => {
    const f = await fixture(t);
    await writeFile(f.manifest, JSON.stringify({ ...f.vocabulary,
        vocabularies: [{ ...f.entry, path: 'vocabularies/manifest.json' }] }));
    await assert.rejects(copyVocabularyCatalog(f.source, f.output), /invalid/);
});

test('listed source aliases cannot traverse unlisted in-catalog archive symlinks', async t => {
    const f = await fixture(t), archive = path.join(f.source, 'vocabularies', 'archive');
    await mkdir(archive); await writeFile(path.join(archive, 'hidden.json'), JSON.stringify(f.vocabulary));
    await rm(f.file); await symlink(path.join(archive, 'hidden.json'), f.file);
    await assert.rejects(copyVocabularyCatalog(f.source, f.output), /symbolic link/);
});
