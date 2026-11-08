import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateBuiltVocabularyCatalog } from './lib/vocabularyCatalogDelivery.mjs';
assert.deepEqual(JSON.parse(await readFile(new URL('../vocabularies/manifest.json', import.meta.url))).vocabularies, [], 'School content must come from the database, not bundled JSON');
const files = await validateBuiltVocabularyCatalog(process.cwd(), fileURLToPath(new URL('../dist-desktop/', import.meta.url)));
console.log(`Validated ${files} catalog delivery files with exact source bytes and no unlisted archive files.`);
