export const DELIVERY_SIZE_BUDGETS = Object.freeze([
  Object.freeze({
    name: 'student',
    label: 'Student initial JS/CSS',
    mode: 'static-graph',
    maximumGzipBytes: 210 * 1024
  }),
  Object.freeze({
    name: 'teacher',
    label: 'Teacher initial JS/CSS',
    mode: 'static-graph',
    maximumGzipBytes: 180 * 1024
  }),
  Object.freeze({
    name: 'reportGenerator',
    label: 'Report Generator lazy chunk',
    mode: 'chunk',
    maximumGzipBytes: 150 * 1024
  }),
  Object.freeze({
    name: 'quizMaker',
    label: 'Quiz Maker lazy chunk',
    mode: 'chunk',
    maximumGzipBytes: 130 * 1024
  }),
  Object.freeze({
    name: 'teacher-charts',
    label: 'Teacher charts lazy chunk',
    mode: 'chunk',
    maximumGzipBytes: 80 * 1024
  })
]);

function findManifestKey(manifest, name) {
  const matches = Object.entries(manifest)
    .filter(([, entry]) => entry?.name === name);
  if (matches.length !== 1) {
    throw new Error(`Expected one production manifest entry named ${name}, found ${matches.length}.`);
  }
  return matches[0][0];
}

export function collectStaticImportKeys(manifest, entryKey, collected = new Set()) {
  if (collected.has(entryKey)) return collected;
  const entry = manifest[entryKey];
  if (!entry?.file) {
    throw new Error(`Production manifest entry ${entryKey} is missing or has no emitted file.`);
  }

  collected.add(entryKey);
  for (const importKey of entry.imports || []) {
    collectStaticImportKeys(manifest, importKey, collected);
  }
  return collected;
}

export function collectStaticDeliveryFiles(manifest, entryKey) {
  const files = new Set();
  for (const key of collectStaticImportKeys(manifest, entryKey)) {
    const entry = manifest[key];
    files.add(entry.file);
    for (const cssFile of entry.css || []) files.add(cssFile);
  }
  return files;
}

export async function measureDeliverySizeBudgets(manifest, gzipFile, budgets = DELIVERY_SIZE_BUDGETS) {
  const results = [];
  for (const budget of budgets) {
    const entryKey = findManifestKey(manifest, budget.name);
    if (!['static-graph', 'chunk'].includes(budget.mode)) {
      throw new Error(`Unknown delivery-size budget mode ${budget.mode} for ${budget.name}.`);
    }
    const deliveryFiles = budget.mode === 'static-graph'
      ? [...collectStaticDeliveryFiles(manifest, entryKey)]
      : [manifest[entryKey].file];

    let actualGzipBytes = 0;
    for (const file of deliveryFiles) {
      actualGzipBytes += await gzipFile(file);
    }
    results.push(Object.freeze({ ...budget, actualGzipBytes, deliveryFiles: Object.freeze(deliveryFiles) }));
  }
  return Object.freeze(results);
}

export function assertDeliverySizeBudgets(results) {
  const exceeded = results.find(result => result.actualGzipBytes > result.maximumGzipBytes);
  if (!exceeded) return;
  const maximumKilobytes = exceeded.maximumGzipBytes / 1024;
  throw new Error(`${exceeded.label} exceeds its ${maximumKilobytes.toFixed(0)} KiB gzip budget.`);
}
