import { cp, mkdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, sep } from 'node:path';
import { STUDENT_GAME_REGISTRY } from '../js/student/studentGameRegistry.js';

const root = process.cwd();
const outDir = join(root, 'dist-desktop');

const entries = [
  'vocabularies',
  'images',
  'favicon.ico',
  'logo.jpeg',
  'student-sw.js'
];

const allowedGameArt = new Set(
  STUDENT_GAME_REGISTRY.map(game => game.art).filter(Boolean)
);

const htmlGameEntries = new Set([
  'js/games/sandbox-storage.js',
  'js/games/legacy-score-bridge.js'
]);
for (const game of STUDENT_GAME_REGISTRY) {
  if (game.launch.mode !== 'html') continue;
  const gamePath = game.launch.path;
  htmlGameEntries.add(dirname(gamePath) === 'js/games' ? gamePath : dirname(gamePath));
}

function shouldCopyAsset(path) {
  const normalizedPath = path.split(sep).join('/');
  const projectPath = relative(root, path).split(sep).join('/');
  const name = basename(path);
  const extension = extname(path).toLowerCase();

  if (normalizedPath.includes('/node_modules/') || normalizedPath.includes('/.git/')) return false;
  if (name === '.DS_Store') return false;
  if (extension === '.zip' || extension === '.map') return false;
  if (name === 'closure.jar' || name === 'shader_minifier.exe') return false;
  if (name === 'package-lock.json' && normalizedPath.includes('/js/games/')) return false;
  if (projectPath.startsWith('images/game-art/') && extension) {
    return allowedGameArt.has(projectPath);
  }

  return true;
}

async function copyEntry(entry) {
  const source = join(root, entry);
  const target = join(outDir, entry);
  try {
    await stat(source);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, {
      recursive: true,
      force: true,
      filter: shouldCopyAsset
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await mkdir(outDir, { recursive: true });

for (const entry of entries) {
  await copyEntry(entry);
}

for (const entry of htmlGameEntries) {
  await copyEntry(entry);
}

console.log(`Desktop assets copied to ${outDir}`);
