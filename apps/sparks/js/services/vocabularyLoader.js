import { requestWithTimeout } from './requestReliability.js';
import { withDefaultSubject } from './vocabularySubjects.js';
import {
    validateVocabularyData,
    validateVocabularyManifest
} from './vocabularyValidation.js';

const vocabFileRequests = new Map();

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

export async function loadManifest({ fresh = true } = {}) {
    try {
        const manifest = validateVocabularyManifest(await fetchManifestFromNetwork({ fresh }));
        if (!manifest) throw new Error('Vocabulary manifest has an invalid format');
        return manifest;
    } catch (error) {
        console.warn('Could not fetch vocabulary manifest from network:', error);
        return null;
    }
}

export async function loadVocabularyFile(path, { fresh = true, silent = false, signal = null, timeoutMs = 10000 } = {}) {
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) return null;

    const requestKey = `${normalizedPath}|${fresh ? 'fresh' : 'normal'}`;
    if (!signal && vocabFileRequests.has(requestKey)) {
        return vocabFileRequests.get(requestKey);
    }

    const request = fetchJsonFromNetwork(normalizedPath, { fresh, signal, timeoutMs })
        .then(data => {
            const vocabulary = validateVocabularyData(data);
            if (!vocabulary) throw new Error(`Vocabulary file ${normalizedPath} has an invalid format`);
            return withDefaultSubject(vocabulary);
        })
        .catch(error => {
            if (!silent) {
                console.warn(`Could not fetch vocabulary file ${normalizedPath}:`, error);
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
