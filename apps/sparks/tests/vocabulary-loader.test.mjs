import assert from 'node:assert/strict';
import test from 'node:test';

const legacyStorage = new Map([
    ['vocab_manifest_cache_v4', JSON.stringify({
        manifest: { version: 'stale' },
        cachedAt: Date.now()
    })],
    ['vocab_file_cache_v2', JSON.stringify({
        entries: {
            'vocabularies/test.json': {
                data: { id: 'stale', words: [] },
                cachedAt: Date.now()
            }
        }
    })]
]);

globalThis.localStorage = {
    getItem(key) { return legacyStorage.get(key) ?? null; },
    setItem(key, value) { legacyStorage.set(key, value); },
    removeItem(key) { legacyStorage.delete(key); }
};
globalThis.window = { location: { href: 'http://127.0.0.1:8000/student.html' } };

const { loadManifest, loadVocabularyFile } = await import('../js/services/vocabularyLoader.js');

function jsonResponse(data) {
    return {
        ok: true,
        async json() { return data; }
    };
}

test('legacy localStorage entries cannot hold manifest or vocabulary data stale', async () => {
    const requestedUrls = [];
    globalThis.fetch = async url => {
        requestedUrls.push(url);
        if (url.endsWith('/manifest.json')) return jsonResponse({
            version: 'current',
            vocabularies: [{ id: 'current', name: 'Current', path: 'vocabularies/test.json' }]
        });
        return jsonResponse({
            id: 'current',
            words: [{ word: 'cache', definition: 'Stored data for faster reuse.' }]
        });
    };

    assert.deepEqual(await loadManifest(), {
        version: 'current',
        vocabularies: [{ id: 'current', name: 'Current', path: 'vocabularies/test.json' }]
    });
    assert.deepEqual(await loadVocabularyFile('vocabularies/test.json'), {
        id: 'current',
        subjectSlug: 'technology',
        words: [{ word: 'cache', definition: 'Stored data for faster reuse.' }]
    });
    assert.equal(requestedUrls.length, 2);
});

test('concurrent vocabulary loads share one request', async () => {
    let fetchCount = 0;
    let releaseFetch;
    globalThis.fetch = async () => {
        fetchCount += 1;
        await new Promise(resolve => { releaseFetch = resolve; });
        return jsonResponse({ id: 'shared', words: [] });
    };

    const first = loadVocabularyFile('vocabularies/shared.json');
    const second = loadVocabularyFile('vocabularies/shared.json');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fetchCount, 1);

    releaseFetch();
    assert.deepEqual(await first, await second);
});

test('sequential vocabulary loads refetch', async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => jsonResponse({
        id: `request-${++fetchCount}`,
        words: []
    });

    const first = await loadVocabularyFile('vocabularies/sequential.json');
    const second = await loadVocabularyFile('vocabularies/sequential.json');

    assert.equal(fetchCount, 2);
    assert.equal(first.id, 'request-1');
    assert.equal(second.id, 'request-2');
});

test('network failures return null instead of legacy cached data', async () => {
    globalThis.fetch = async () => { throw new Error('offline'); };
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
        assert.equal(await loadManifest(), null);
        assert.equal(await loadVocabularyFile('vocabularies/test.json', { silent: true }), null);
    } finally {
        console.warn = originalWarn;
    }
});

test('malformed network vocabulary and manifest payloads are rejected', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        globalThis.fetch = async url => url.endsWith('/manifest.json')
            ? jsonResponse({ vocabularies: [{ id: 'missing-path', name: 'Broken' }] })
            : jsonResponse({ id: 'broken', words: [{ word: 'missing definition' }] });

        assert.equal(await loadManifest(), null);
        assert.equal(await loadVocabularyFile('vocabularies/broken.json'), null);
    } finally {
        console.warn = originalWarn;
    }
});
