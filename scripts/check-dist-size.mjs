import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

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
