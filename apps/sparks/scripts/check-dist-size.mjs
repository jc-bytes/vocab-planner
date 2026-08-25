import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import {
  assertDeliverySizeBudgets,
  measureDeliverySizeBudgets
} from './lib/deliverySizeBudgets.mjs';

const outputDirectory = join(process.cwd(), 'dist-desktop');
const maximumBytes = Number(process.env.MAX_DIST_BYTES || 30 * 1024 * 1024);

async function directorySize(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    total += entry.isDirectory() ? await directorySize(path) : (await stat(path)).size;
  }
  return total;
}

const bytes = await directorySize(outputDirectory);
const megabytes = bytes / 1024 / 1024;
const maximumMegabytes = maximumBytes / 1024 / 1024;
console.log(`Deployment size: ${megabytes.toFixed(1)} MB (limit ${maximumMegabytes.toFixed(1)} MB).`);

if (bytes > maximumBytes) {
  throw new Error(`Deployment exceeds its ${maximumMegabytes.toFixed(1)} MB size budget.`);
}

const manifest = JSON.parse(await readFile(join(outputDirectory, '.vite', 'manifest.json'), 'utf8'));
const deliveryResults = await measureDeliverySizeBudgets(
  manifest,
  async file => gzipSync(await readFile(join(outputDirectory, file)), { level: 9 }).length
);

for (const result of deliveryResults) {
  const actualKilobytes = result.actualGzipBytes / 1024;
  const maximumKilobytes = result.maximumGzipBytes / 1024;
  console.log(`${result.label}: ${actualKilobytes.toFixed(1)} KiB gzip (limit ${maximumKilobytes.toFixed(0)} KiB).`);
}
assertDeliverySizeBudgets(deliveryResults);
