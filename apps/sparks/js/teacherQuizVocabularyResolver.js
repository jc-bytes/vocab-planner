import { loadVocabularyFile } from './services/vocabularyApi.js';
import { vocabularyRepository } from './services/vocabularyRepository.js';

function cloneVocabulary(vocabulary) {
    return JSON.parse(JSON.stringify(vocabulary));
}

export async function resolveQuizVocabularyItem({ vocab, type } = {}, dependencies = {}) {
    if (!vocab || typeof vocab !== 'object') {
        throw new Error('Quiz vocabulary metadata is required.');
    }

    let resolved;

    if (type === 'remote') {
        if (!vocab.path) throw new Error('Remote Quiz vocabulary path is required.');
        const loadRemote = dependencies.loadRemote || loadVocabularyFile;
        resolved = await loadRemote(vocab.path);
    } else if (type === 'cloud') {
        if (!vocab.id) throw new Error('Cloud Quiz vocabulary ID is required.');
        const loadCloud = dependencies.loadCloud || (id => vocabularyRepository.get(id));
        resolved = await loadCloud(vocab.id);
    } else if (type === 'local') {
        resolved = vocab;
    } else {
        throw new Error(`Unsupported Quiz vocabulary source: ${String(type || '')}`);
    }

    if (!resolved || !Array.isArray(resolved.words)) {
        throw new Error('Resolved Quiz vocabulary is missing its words array.');
    }

    const clone = cloneVocabulary(resolved);
    clone.source = type;
    if (type === 'remote') clone.path = vocab.path;
    return clone;
}
