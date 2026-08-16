import JSZip from 'jszip';
import { Packer } from 'docx';
import { readFile } from 'node:fs/promises';
import { buildQuizWordDocument } from '../js/quizMakerWordExportMethods.js';
import { getActivityXp, getLevelProgress, getStudentExperience } from '../js/student/studentExperience.js';

function assertIncludes(text, needle, label) {
    if (text.includes(needle)) return;
    throw new Error(`${label}: expected generated DOCX XML to include "${needle}"`);
}

function createQuizFixture() {
    const sections = [
        {
            type: 'mc',
            title: 'Multiple Choice',
            instructions: 'Choose the best answer.',
            questions: [{
                type: 'mc',
                prompt: 'Which part stores data?',
                points: 1,
                options: ['CPU', 'Keyboard', 'Storage', 'Monitor']
            }]
        },
        {
            type: 'sata',
            title: 'Select All That Apply',
            instructions: 'Select every correct answer.',
            questions: [{
                type: 'sata',
                prompt: 'Select input devices.',
                points: 2,
                options: [{ text: 'Keyboard' }, { text: 'Mouse' }, { text: 'Speaker' }]
            }]
        },
        {
            type: 'tf',
            title: 'True or False',
            instructions: 'Write T or F.',
            questions: [{ type: 'tf', prompt: 'A spreadsheet uses cells.', points: 1 }]
        },
        {
            type: 'matching_section',
            title: 'Matching',
            instructions: 'Match each term.',
            questions: [{
                type: 'matching_section',
                prompt: 'Match terms.',
                points: 2,
                pairs: [{ term: 'Algorithm', def: 'Step-by-step plan' }]
            }]
        },
        {
            type: 'short',
            title: 'Short Answer',
            instructions: 'Answer in complete sentences.',
            questions: [{ type: 'short', prompt: 'Explain why formulas are useful.', points: 2 }]
        },
        {
            type: 'synonym',
            title: 'Synonyms & Antonyms',
            instructions: 'Choose the best word.',
            questions: [{
                type: 'synonym',
                prompt: 'Choose a synonym for fix.',
                points: 1,
                options: ['Repair', 'Break', 'Ignore']
            }]
        },
        {
            type: 'wordsearch',
            title: 'Word Search',
            instructions: 'Find all words.',
            questions: [{
                type: 'wordsearch',
                prompt: 'Find vocabulary words.',
                points: 3,
                grid: [['C', 'P', 'U'], ['R', 'A', 'M']],
                words: ['CPU', 'RAM']
            }]
        },
        {
            type: 'crossword',
            title: 'Crossword Puzzle',
            instructions: 'Use the clues.',
            questions: [{
                type: 'crossword',
                prompt: 'Complete the crossword.',
                points: 3,
                grid: [[{ letter: 'C' }, {}], [{}, { letter: 'P' }]],
                clues: {
                    across: [{ number: 1, clue: 'Computer brain' }],
                    down: [{ number: 2, clue: 'Programming plan' }]
                }
            }]
        }
    ];

    return {
        meta: {
            title: 'Technology Quiz',
            instructions: 'Use black or blue pen.',
            schoolName: 'ACADEMIA INTERNACIONAL DE DAVID',
            teacherName: 'Porfirio Rios',
            grade: '6',
            rubric: [
                { title: 'Date and Name:', desc: 'Complete name and date.', points: 2 },
                { title: 'Content:', desc: 'Correct answers.', points: 15 }
            ]
        },
        groupQuestionsByType() {
            return sections;
        }
    };
}

async function runDocxTests() {
    const document = buildQuizWordDocument(createQuizFixture());
    const buffer = await Packer.toBuffer(document);
    if (!buffer || buffer.length < 1000) {
        throw new Error(`DOCX buffer is unexpectedly small: ${buffer?.length || 0}`);
    }

    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
        throw new Error('Generated DOCX is missing word/document.xml');
    }

    assertIncludes(documentXml, 'Technology Quiz', 'DOCX title');
    assertIncludes(documentXml, 'Use black or blue pen.', 'DOCX instructions');
    assertIncludes(documentXml, 'Date and Name:', 'DOCX rubric');
    assertIncludes(documentXml, 'Which part stores data?', 'DOCX multiple choice');
    assertIncludes(documentXml, 'Algorithm', 'DOCX matching');
    assertIncludes(documentXml, 'Find vocabulary words.', 'DOCX word search');
    assertIncludes(documentXml, 'Complete the crossword.', 'DOCX crossword');
}

function runStudentExperienceTests() {
    if (getActivityXp('flashcards') !== 10) throw new Error('Flashcards should use the easiest XP reward.');
    if (getActivityXp('crossword') !== 35) throw new Error('Crossword should use a medium-high XP reward.');
    if (getActivityXp('illustration') !== 50) throw new Error('Illustration should use the highest XP reward.');
    if (getActivityXp('unknown-activity') !== 10) throw new Error('Unknown activities should use the safe minimum XP reward.');

    const experience = getStudentExperience({
        units: {
            'technology:week-1': {
                unitId: 'week-1',
                scores: {
                    matching: { score: 100, isComplete: true },
                    quiz: { score: 80, isComplete: false },
                    flashcards: { score: 100 }
                }
            },
            'Week 1': {
                unitId: 'week-1',
                scores: {
                    matching: { score: 100, isComplete: true }
                }
            },
            'technology:week-2': {
                unitId: 'week-2',
                scores: {
                    matching: { score: 100, isComplete: true },
                    quiz: { score: 100, isComplete: true },
                    flashcards: { score: 100, isComplete: true }
                }
            }
        }
    });

    if (experience.completedCount !== 5) throw new Error('XP should count unique completed activities.');
    if (experience.totalXp !== 100) throw new Error('Five completed activities should earn 100 XP.');
    if (experience.level !== 2) throw new Error('A student should reach level 2 at 100 XP.');
    if (experience.xpIntoLevel !== 0) throw new Error('XP progress should reset at a new level.');
    if (experience.xpForNextLevel !== 150) throw new Error('Level 2 should require 150 XP.');

    const progressed = getLevelProgress(450);
    if (progressed.level !== 4 || progressed.xpIntoLevel !== 0 || progressed.xpForNextLevel !== 250) {
        throw new Error('Progressive XP thresholds should be 100, 150, 200, 250...');
    }
    if (progressed.title !== 'Builder') throw new Error('Levels 3-5 should use the Builder title.');

    const authoritative = getStudentExperience({ totalXp: 249, units: {} });
    if (authoritative.level !== 2 || authoritative.xpIntoLevel !== 149) {
        throw new Error('Supabase total XP should be authoritative when present.');
    }
}

async function runLeaderboardContractTests() {
    const leaderboardSource = await readFile(
        new URL('../js/student/studentGameRegistry.js', import.meta.url),
        'utf8'
    );
    const migrationSources = await Promise.all([
        readFile(new URL('../supabase/migrations/20260620133911_enable_trapdoor_trials_leaderboard.sql', import.meta.url), 'utf8'),
        readFile(new URL('../supabase/migrations/20260620020403_enable_canvas_game_leaderboards.sql', import.meta.url), 'utf8'),
        readFile(new URL('../supabase/migrations/20260620135443_remove_level_devil_game_score.sql', import.meta.url), 'utf8'),
        readFile(new URL('../supabase/migrations/20260621004928_enable_tilt_maze_basic_platformer_leaderboards.sql', import.meta.url), 'utf8'),
        readFile(new URL('../supabase/migrations/20260621010445_enable_tower_platformer_leaderboard.sql', import.meta.url), 'utf8'),
        readFile(new URL('../supabase/migrations/20260621011648_replace_scratch_arcade_games.sql', import.meta.url), 'utf8')
    ]);
    const migrationSource = migrationSources.join('\n');
    const canvasGames = [
        'galactic-breaker',
        'snake',
        'flappy-bird',
        'space-invaders',
        'target-shooter',
        'pong',
        'whack-a-mole',
        'trapdoor-trials',
        'tilt-maze',
        'basic-platformer',
        'tower-platformer'
    ];

    for (const gameId of canvasGames) {
        if (!leaderboardSource.includes(`'${gameId}'`)) {
            throw new Error(`Client leaderboard allowlist is missing ${gameId}.`);
        }
        if (!migrationSource.includes(`'${gameId}'`)) {
            throw new Error(`Database leaderboard allowlist is missing ${gameId}.`);
        }
    }
}

async function runTrapdoorTrialsContractTests() {
    const [studentSource, lifecycleSource, loaderSource, trialHtml, trialStyles, trialGame, trialLicense] = await Promise.all([
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameHtmlLoaderMethods.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/trapdoor-trials/index.html', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/trapdoor-trials/style.css', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/trapdoor-trials/game.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/trapdoor-trials/LICENSE', import.meta.url), 'utf8')
    ]);

    const whackIndex = studentSource.indexOf("id: 'whack-a-mole'");
    const trialIndex = studentSource.indexOf("id: 'trapdoor-trials'");
    const tiltMazeIndex = studentSource.indexOf("id: 'tilt-maze'");
    if (!(whackIndex < trialIndex && trialIndex < tiltMazeIndex)) {
        throw new Error('Trapdoor Trials must appear between Whack-a-Mole and Tilt Maze.');
    }
    if (/level.?devil/i.test(`${studentSource}\n${lifecycleSource}\n${loaderSource}`)) {
        throw new Error('Removed Level Devil integration is still referenced by the student app.');
    }
    if (!lifecycleSource.includes("'js/games/trapdoor-trials/index.html'")) {
        throw new Error('Trapdoor Trials launch path is missing.');
    }
    if (/https?:\/\//.test(trialHtml)) {
        throw new Error('Trapdoor Trials HTML must not load remote resources.');
    }
    if (/\b(?:fd|ld)_/.test(trialGame)) {
        throw new Error('Trapdoor Trials must use isolated tt_* storage keys.');
    }
    if (/fable|devil|blood|stain/i.test(`${trialHtml}\n${trialStyles}\n${trialGame}`)) {
        throw new Error('Trapdoor Trials contains retired branding or effects.');
    }
    if (!trialGame.includes('type: "trapdoor-trials-score"') || !studentSource.includes("scoreMessageType: 'trapdoor-trials-score'")) {
        throw new Error('Trapdoor Trials leaderboard reporting contract is incomplete.');
    }
    if (!trialLicense.startsWith('MIT License')) {
        throw new Error('Trapdoor Trials must retain its upstream MIT license.');
    }
}

async function runTiltMazeContractTests() {
    const [studentSource, lifecycleSource, loaderSource, tiltHtml, tiltStyles, tiltGame, tiltLicense, threeLicense] = await Promise.all([
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameHtmlLoaderMethods.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/tilt-maze/index.html', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/tilt-maze/styles.css', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/tilt-maze/src/main.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/tilt-maze/LICENSE', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/tilt-maze/vendor/THREE-LICENSE', import.meta.url), 'utf8')
    ]);

    const tiltMazeIndex = studentSource.indexOf("id: 'tilt-maze'");
    if (tiltMazeIndex < 0) {
        throw new Error('Tilt Maze is missing from the arcade.');
    }
    if (/ball-roll-3d|3D Ball Roll|\[3D\]ボールころころ2/.test(`${studentSource}\n${lifecycleSource}`)) {
        throw new Error('Removed 3D Ball Roll integration is still referenced by the student app.');
    }
    if (/neverball|play\.neverball\.org/i.test(`${studentSource}\n${lifecycleSource}\n${loaderSource}`)) {
        throw new Error('Removed Neverball integration is still referenced by the student app.');
    }
    if (!lifecycleSource.includes("'js/games/tilt-maze/index.html'")) {
        throw new Error('Tilt Maze launch path is missing.');
    }
    if (!studentSource.includes("id: 'tilt-maze'") || !studentSource.includes('responsive: true')) {
        throw new Error('Tilt Maze responsive iframe sizing is incomplete.');
    }
    if (/(?:src|href)=["']https?:\/\//.test(tiltHtml)) {
        throw new Error('Tilt Maze HTML must not load remote resources.');
    }
    if (!/#stage\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/.test(tiltStyles)) {
        throw new Error('Tilt Maze canvas must keep its CSS size independent of device pixel ratio.');
    }
    if (!tiltGame.includes('g.index ? g.toNonIndexed() : g')) {
        throw new Error('Tilt Maze must flatten indexed wall geometry before merging it.');
    }
    if (!tiltGame.includes('opacity: 0.06, depthWrite: false') || !tiltGame.includes('opacity: 0.85, depthTest: false')) {
        throw new Error('Tilt Maze shell and goal depth settings must keep the maze visible.');
    }
    if (!tiltLicense.startsWith('MIT License') || !threeLicense.startsWith('The MIT License')) {
        throw new Error('Tilt Maze and Three.js must retain their MIT licenses.');
    }
}

async function runBasicPlatformerContractTests() {
    const [studentSource, lifecycleSource, loaderSource, gameHtml, gameBundle, gameLicense, attribution, contentSource] = await Promise.all([
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameHtmlLoaderMethods.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/basic-platformer/index.html', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/basic-platformer/BasicPlatformer.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/basic-platformer/LICENSE', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/basic-platformer/ATTRIBUTION.md', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/basic-platformer/source-project/source/Content.hx', import.meta.url), 'utf8')
    ]);

    const tiltMazeIndex = studentSource.indexOf("id: 'tilt-maze'");
    const platformerIndex = studentSource.indexOf("id: 'basic-platformer'");
    const towerIndex = studentSource.indexOf("id: 'tower-platformer'");
    if (!(tiltMazeIndex < platformerIndex && platformerIndex < towerIndex)) {
        throw new Error('BasicPlatformer must remain between Tilt Maze and Tower Climb.');
    }
    if (/id: 'appel'|type === 'appel'|Appel v1\.html/.test(`${studentSource}\n${lifecycleSource}`)) {
        throw new Error('Removed Appel integration is still referenced by the student app.');
    }
    if (!lifecycleSource.includes("'js/games/basic-platformer/index.html'")) {
        throw new Error('BasicPlatformer launch path is missing.');
    }
    if (!studentSource.includes("name: 'Circuit Sprint'") || !gameHtml.includes('Checkpoint Runner: Circuit Sprint')) {
        throw new Error('Circuit Sprint naming must stay visible in the arcade and game shell.');
    }
    for (const hook of ['__basicPlatformerStartLevel', '__basicPlatformerReportAttempt', '__basicPlatformerReportCheckpoint', '__basicPlatformerReportScore']) {
        if (!gameHtml.includes(hook) || !gameBundle.includes(hook)) {
            throw new Error(`Circuit Sprint scoring hook is missing: ${hook}.`);
        }
    }
    if (!gameHtml.includes('runner-hud') || !gameHtml.includes('speedBonus') || !gameBundle.includes('Warmup Circuit')) {
        throw new Error('Circuit Sprint HUD, speed scoring, and level names must remain wired.');
    }
    if (!/id: 'basic-platformer'[\s\S]*?width: 1280, height: 720/.test(studentSource)) {
        throw new Error('BasicPlatformer must retain its 1280x720 frame ratio.');
    }
    if (/(?:src|href)=["']https?:\/\//.test(gameHtml)) {
        throw new Error('BasicPlatformer HTML must not load remote resources.');
    }
    if (gameBundle.includes('simple_tileset_32.tsx') || !gameBundle.includes('simple_tileset_32.xml')) {
        throw new Error('BasicPlatformer tileset must use its Vite-safe XML extension.');
    }
    if (!gameLicense.startsWith('MIT License')) {
        throw new Error('BasicPlatformer must retain its upstream MIT license.');
    }
    if (!attribution.includes('Creative Commons Attribution 4.0 International') || !attribution.includes('Avace')) {
        throw new Error('BasicPlatformer must retain its asset attribution.');
    }
    const levelCount = (contentSource.match(/AssetPaths\.Area_0_Level_\d+__tmx/g) || []).length;
    if (levelCount !== 6) {
        throw new Error(`BasicPlatformer source snapshot should contain six levels, found ${levelCount}.`);
    }
}

async function runTowerPlatformerContractTests() {
    const [studentSource, lifecycleSource, loaderSource, gameHtml, gameSource, gameLicense, readme] = await Promise.all([
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameHtmlLoaderMethods.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/tower-platformer/index.html', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/tower-platformer/js/tower.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/tower-platformer/license', import.meta.url), 'utf8'),
        readFile(new URL('../js/games/tower-platformer/readme.md', import.meta.url), 'utf8')
    ]);

    const platformerIndex = studentSource.indexOf("id: 'basic-platformer'");
    const towerIndex = studentSource.indexOf("id: 'tower-platformer'");
    const radiusIndex = studentSource.indexOf("id: 'radius-raid'");
    if (!(platformerIndex < towerIndex && towerIndex < radiusIndex)) {
        throw new Error('Tower Climb must replace Ball Blast between Circuit Sprint and Radius Raid.');
    }
    if (/id: 'ball-blast'|type === 'ball-blast'|Ball Blast - Mobile friendly/.test(`${studentSource}\n${lifecycleSource}`)) {
        throw new Error('Removed Ball Blast integration is still referenced by the student app.');
    }
    if (!studentSource.includes("name: 'Tower Climb'") || !lifecycleSource.includes("'js/games/tower-platformer/index.html'")) {
        throw new Error('Tower Climb arcade card or launch path is missing.');
    }
    if (!/id: 'tower-platformer'[\s\S]*?responsive: true/.test(studentSource)) {
        throw new Error('Tower Climb responsive iframe sizing is missing.');
    }
    if (/(?:src|href)=["']https?:\/\//.test(gameHtml)) {
        throw new Error('Tower Climb HTML must not load remote resources.');
    }
    if (!gameSource.includes("type: 'tower-platformer-score'") || !gameSource.includes('window.parent.postMessage')) {
        throw new Error('Tower Climb leaderboard score reporting is missing.');
    }
    if (!gameLicense.startsWith('Copyright (c) 2013') || !readme.includes('MIT')) {
        throw new Error('Tower Climb must retain its upstream MIT license/readme.');
    }
}

async function runRemovedArcadeGamesContractTests() {
    const [studentSource, lifecycleSource, loaderSource] = await Promise.all([
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameRegistry.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/student/studentGameHtmlLoaderMethods.js', import.meta.url), 'utf8')
    ]);

    const spacePiIndex = studentSource.indexOf("id: 'spacepi'");
    const blackHoleIndex = studentSource.indexOf("id: 'black-hole-square'");
    if (!(spacePiIndex < blackHoleIndex)) {
        throw new Error('Black Hole Square must follow SpacePi after the removed Scratch replacement slots.');
    }
    if (/id: 'mystic-valley'|id: 'slash-knight'|id: 'coin-runner'|id: 'relic-runner'|type === 'mystic-valley'|type === 'slash-knight'|type === 'coin-runner'|type === 'relic-runner'|Mystic Valley\.html|Slash Knight\.html|coin-runner-score|relic-runner-score/.test(`${studentSource}\n${lifecycleSource}\n${loaderSource}`)) {
        throw new Error('Removed Scratch replacement integrations are still referenced by the active student app.');
    }
}

await runDocxTests();
runStudentExperienceTests();
await runLeaderboardContractTests();
await runTrapdoorTrialsContractTests();
await runTiltMazeContractTests();
await runBasicPlatformerContractTests();
await runTowerPlatformerContractTests();
await runRemovedArcadeGamesContractTests();

console.log('Package refactor tests passed.');
