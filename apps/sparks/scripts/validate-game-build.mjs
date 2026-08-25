import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { STUDENT_GAME_REGISTRY } from '../js/student/studentGameRegistry.js';

const root = process.cwd();
const outDir = join(root, 'dist-desktop');
const manifest = JSON.parse(await readFile(join(outDir, '.vite', 'manifest.json'), 'utf8'));

for (const game of STUDENT_GAME_REGISTRY) {
    await access(join(outDir, game.art));
    if (game.launch.mode === 'html') {
        await access(join(outDir, game.launch.path));
    }
}

const studentEntry = manifest['student.html'];
const gamesEntryKey = 'js/student/studentGames.js';
const gamesEntry = manifest[gamesEntryKey];
const canvasGames = STUDENT_GAME_REGISTRY.filter(game => game.launch.mode === 'canvas');

if (!studentEntry?.dynamicImports?.includes(gamesEntryKey) || gamesEntry?.isDynamicEntry !== true) {
    throw new Error('Student Games must remain a lazy production entry.');
}
if (gamesEntry.dynamicImports?.length !== canvasGames.length) {
    throw new Error(`Expected ${canvasGames.length} lazy canvas game entries, found ${gamesEntry.dynamicImports?.length ?? 0}.`);
}

for (const gameEntryKey of gamesEntry.dynamicImports) {
    if (!gameEntryKey.startsWith('js/games/')) {
        throw new Error(`Unexpected lazy entry in the Student Games bundle: ${gameEntryKey}`);
    }
    const gameEntry = manifest[gameEntryKey];
    if (gameEntry?.isDynamicEntry !== true || !gameEntry.file) {
        throw new Error(`Canvas game entry is not emitted lazily: ${gameEntryKey}`);
    }
    await access(join(outDir, gameEntry.file));
}

console.log(`Validated ${STUDENT_GAME_REGISTRY.length} registered games and ${canvasGames.length} lazy canvas bundles.`);
