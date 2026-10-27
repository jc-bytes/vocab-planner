import { fileURLToPath } from 'node:url';
import { validateBuiltVocabularyCatalog } from './lib/vocabularyCatalogDelivery.mjs';
const files = await validateBuiltVocabularyCatalog(process.cwd(), fileURLToPath(new URL('../dist-desktop/', import.meta.url)));
console.log(`Validated ${files} catalog delivery files with exact source bytes and no unlisted archive files.`);
