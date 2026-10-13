import test from 'node:test';
import assert from 'node:assert/strict';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: { getItem() { return null; }, setItem() {} } });
globalThis.window = { location: { href: 'https://example.com/student.html' } };
const { loadManifest, loadVocabularyFile } = await import('../js/services/vocabularyLoader.js');

test('startup ignores a still-young stored catalog and updates the required activities', async (t) => {
    const old = { vocabularies: [{ id: 'part2', name: 'Part 2', path: 'vocabularies/part2.json' }] };
    const fresh = { vocabularies: [{ id: 'part2', name: 'Part 2', path: 'vocabularies/part2.json', activitySettings: { requiredActivities: ['flashcards', 'fill-in-blank'] } }] };
    const values = new Map([['vocab_manifest_cache_v4', JSON.stringify({ cachedAt: Date.now(), manifest: old })]]);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) } });

    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(options.cache, 'reload');
        return { ok: true, json: async () => fresh };
    });
    assert.deepEqual(await loadManifest(), fresh);
    assert.deepEqual(JSON.parse(values.get('vocab_manifest_cache_v4')).manifest, old, 'Network data does not recreate the legacy storage cache');
});

test('offline failures reject legacy storage while vocabulary content is revalidated', async (t) => {
    const cached = { vocabularies: [{ id: 'part2', name: 'Part 2', path: 'vocabularies/part2.json' }] };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: { getItem: key => key === 'vocab_manifest_cache_v4' ? JSON.stringify({ cachedAt: Date.now(), manifest: cached }) : null, setItem() {} } });

    t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(options.cache, 'reload');
        if (url.endsWith('manifest.json')) throw new Error('offline');
        return { ok: true, json: async () => ({ id: 'part2', words: [] }) };
    });
    assert.equal(await loadManifest(), null, 'Offline caching belongs to the versioned service worker');
    assert.equal((await loadVocabularyFile('vocabularies/part2.json')).id, 'part2');
});
