import { requestWithTimeout } from './requestReliability.js';
import { withDefaultSubject } from './vocabularySubjects.js';

const MANIFEST_CACHE_KEY = 'vocab_manifest_cache_v4';

const MANIFEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const VOCAB_FILE_CACHE_KEY = 'vocab_file_cache_v2';

const VOCAB_FILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const vocabFileRequests = new Map();

function readManifestCache() {
    try {
        const raw = localStorage.getItem(MANIFEST_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.manifest || !parsed?.cachedAt) return null;
        return parsed;
    } catch (error) {
        console.warn('Could not read vocabulary manifest cache:', error);
        return null;
    }
}

function writeManifestCache(manifest) {
    try {
        localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify({
            manifest,
            cachedAt: Date.now()
        }));
    } catch (error) {
        console.warn('Could not write vocabulary manifest cache:', error);
    }
}

function isManifestCacheFresh(cacheEntry) {
    return cacheEntry && Date.now() - Number(cacheEntry.cachedAt) < MANIFEST_CACHE_TTL_MS;
}

async function fetchManifestFromNetwork(options = {}) {
    return fetchJsonFromNetwork('vocabularies/manifest.json', options);
}

async function fetchJsonFromNetwork(path, { fresh = false, signal = null, timeoutMs = 10000 } = {}) {
    const url = new URL(path, window.location.href);
    const response = await requestWithTimeout(requestSignal => fetch(url.toString(), {
        cache: fresh ? 'reload' : 'default',
        signal: requestSignal
    }), {
        signal,
        timeoutMs,
        label: `Loading ${path}`
    });
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return response.json();
}

export async function loadManifest({ fresh = false } = {}) {
    const cached = readManifestCache();

    if (!fresh && isManifestCacheFresh(cached)) {
        return cached.manifest;
    }

    try {
        const manifest = await fetchManifestFromNetwork({ fresh });
        if (manifest) {
            writeManifestCache(manifest);
        }
        return manifest;
    } catch (error) {
        console.warn('Could not fetch vocabulary manifest from network:', error);
        if (cached?.manifest) {
            return cached.manifest;
        }
        return null;
    }
}

function readVocabFileCache() {
    try {
        const raw = localStorage.getItem(VOCAB_FILE_CACHE_KEY);
        if (!raw) return { entries: {} };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { entries: {} };
        return {
            entries: parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {}
        };
    } catch (error) {
        console.warn('Could not read vocabulary file cache:', error);
        return { entries: {} };
    }
}

function writeVocabFileCache(cache) {
    try {
        localStorage.setItem(VOCAB_FILE_CACHE_KEY, JSON.stringify({
            entries: cache.entries || {}
        }));
    } catch (error) {
        console.warn('Could not write vocabulary file cache:', error);
    }
}

function getCachedVocabFile(path) {
    const cache = readVocabFileCache();
    const entry = cache.entries?.[path];
    return entry?.data && entry?.cachedAt ? entry : null;
}

function isVocabFileCacheFresh(entry) {
    return entry && Date.now() - Number(entry.cachedAt) < VOCAB_FILE_CACHE_TTL_MS;
}

function writeCachedVocabFile(path, data) {
    const cache = readVocabFileCache();
    cache.entries[path] = {
        data,
        cachedAt: Date.now()
    };
    writeVocabFileCache(cache);
}

export async function loadVocabularyFile(path, { fresh = false, silent = false, signal = null, timeoutMs = 10000 } = {}) {
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) return null;

    const cached = getCachedVocabFile(normalizedPath);
    if (!fresh && isVocabFileCacheFresh(cached)) {
        return withDefaultSubject(cached.data);
    }

    const requestKey = `${normalizedPath}|${fresh ? 'fresh' : 'normal'}`;
    if (!signal && vocabFileRequests.has(requestKey)) {
        return vocabFileRequests.get(requestKey);
    }

    const request = fetchJsonFromNetwork(normalizedPath, { fresh, signal, timeoutMs })
        .then(data => {
            if (data) {
                writeCachedVocabFile(normalizedPath, data);
            }
            return data ? withDefaultSubject(data) : data;
        })
        .catch(error => {
            if (!silent) {
                console.warn(`Could not fetch vocabulary file ${normalizedPath}:`, error);
            }
            if (cached?.data) {
                return withDefaultSubject(cached.data);
            }
            return null;
        })
        .finally(() => {
            if (!signal) vocabFileRequests.delete(requestKey);
        });

    if (!signal) vocabFileRequests.set(requestKey, request);
    return request;
}

export function preloadVocabularyFile(path) {
    return loadVocabularyFile(path, { silent: true }).catch(() => null);
}
