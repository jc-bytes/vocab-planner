import { cp, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'dist-desktop');

const entries = [
  'vocabularies',
  'images',
  'js/games',
  'js/libs',
  'join',
  'LvL-Devil-main',
  'PolyDash-main',
  'favicon.ico',
  'logo.jpeg',
  'Micro_bit V2 - vocab test - v1.pdf',
  'format example.pdf'
];

await mkdir(outDir, { recursive: true });

for (const entry of entries) {
  const source = join(root, entry);
  const target = join(outDir, entry);
  try {
    await stat(source);
    await cp(source, target, {
      recursive: true,
      force: true,
      filter: path => !path.includes('node_modules') && !path.includes('/.git/')
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

console.log(`Desktop assets copied to ${outDir}`);
