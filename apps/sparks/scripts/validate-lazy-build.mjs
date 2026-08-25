import { readFile } from 'node:fs/promises';

import { validateLazyBuildContracts } from './lib/lazyBuildContracts.mjs';
import { collectStudentPrecacheFiles } from './student-precache.mjs';

const manifest = JSON.parse(await readFile('dist-desktop/.vite/manifest.json', 'utf8'));
const studentEntryKey = Object.keys(manifest).find(key => manifest[key]?.name === 'student');
const result = validateLazyBuildContracts(manifest, {
  precacheFiles: collectStudentPrecacheFiles(manifest, studentEntryKey)
});

console.log(
  `Validated ${result.checkedEdges} required lazy edges and ${result.optionalFeatureCount} optional feature boundaries.`
);
