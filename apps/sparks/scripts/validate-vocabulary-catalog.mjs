import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    loadVocabularyCatalog,
    validateVocabulary,
    writeNormalizedVocabulary
} from './lib/vocabularyCatalog.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shouldWrite = process.argv.includes('--write');
const records = await loadVocabularyCatalog(workspaceRoot);

if (shouldWrite) {
    for (const record of records) {
        record.vocabulary = await writeNormalizedVocabulary(record);
    }
}

const errors = records.flatMap(record => validateVocabulary(record.vocabulary, record.entry.path));
if (errors.length > 0) {
    throw new Error(`Vocabulary catalog validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
}

process.stdout.write(`${shouldWrite ? 'Normalized and validated' : 'Validated'} ${records.length} vocabulary units.\n`);
