import { cp, mkdir, stat } from 'node:fs/promises';
import { basename, extname, join, sep } from 'node:path';

const root = process.cwd();
const outDir = join(root, 'dist-desktop');

const entries = [
  'vocabularies',
  'images',
  'js/games',
  'js/libs',
  'join',
  'PolyDash-main',
  'favicon.ico',
  'logo.jpeg',
  'Micro_bit V2 - vocab test - v1.pdf',
  'format example.pdf'
];

function shouldCopyAsset(path) {
  const normalizedPath = path.split(sep).join('/');
  const name = basename(path);
  const extension = extname(path).toLowerCase();

  if (normalizedPath.includes('/node_modules/') || normalizedPath.includes('/.git/')) return false;
  if (name === '.DS_Store') return false;
  if (extension === '.zip' || extension === '.map') return false;
  if (name === 'closure.jar' || name === 'shader_minifier.exe') return false;
  if (name === 'package-lock.json' && normalizedPath.includes('/js/games/')) return false;

  return true;
}

await mkdir(outDir, { recursive: true });

for (const entry of entries) {
  const source = join(root, entry);
  const target = join(outDir, entry);
  try {
    await stat(source);
    await cp(source, target, {
      recursive: true,
      force: true,
      filter: shouldCopyAsset
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

console.log(`Desktop assets copied to ${outDir}`);
