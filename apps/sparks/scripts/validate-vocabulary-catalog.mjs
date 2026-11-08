import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
const root = new URL('../vocabularies/', import.meta.url);
const files = await readdir(root, { recursive: true, withFileTypes: true });
assert.deepEqual(files.filter(file => file.isFile()).map(file => file.name), ['manifest.json'], 'School vocabulary must not be bundled with the app');
assert.deepEqual(JSON.parse(await readFile(new URL('manifest.json', root))).vocabularies, [], 'The compatibility index must stay empty');
if (process.argv.includes('--write')) throw new Error('File catalog editing is retired. Edit vocabulary in the teacher library.');
console.log('Verified database-only school content and empty compatibility index.');
