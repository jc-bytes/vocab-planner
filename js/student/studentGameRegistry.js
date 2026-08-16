function canvasGame({ id, name, icon, art, desc, load, exportName, leaderboard = true, create }) {
    return {
        id, name, icon, art, desc, leaderboard,
        launch: Object.freeze({ mode: 'canvas', load, exportName, create })
    };
}

function htmlGame({ id, name, icon, art, desc, path, scoreMessageType = null, leaderboard = Boolean(scoreMessageType), frame = {} }) {
    return {
        id, name, icon, art, desc, leaderboard,
        launch: Object.freeze({ mode: 'html', path, scoreMessageType, frame: Object.freeze(frame) })
    };
}

const standardCanvasFactory = (ExportedGame, { canvas, gameOverCallback }) => new ExportedGame(canvas, gameOverCallback);

export const STUDENT_GAME_REGISTRY = Object.freeze([
    canvasGame({
        id: 'galactic-breaker', name: 'Galactic Breaker', icon: 'layout-grid',
        art: 'images/game-art/galactic-breaker-cover-neon-cyberpunk-v1.webp', desc: 'Break bricks in space!',
        load: () => import('../games/galacticBreaker.js'), exportName: 'GalacticBreaker',
        create: (GalacticBreaker, { canvas, gameOverCallback, games }) => {
            const scoreDisplay = document.querySelector('#game-score');
            const updateScore = score => {
                const numericScore = Number(score) || 0;
                games.currentGameScore = numericScore;
                if (scoreDisplay) {
                    scoreDisplay.style.display = 'block';
                    scoreDisplay.textContent = `Score: ${numericScore.toLocaleString()}`;
                }
            };
            games.currentGameScore = 0;
            games.currentGameMetadata = null;
            updateScore(0);
            return new GalacticBreaker(canvas, gameOverCallback, updateScore, () => games.gameTimeRemaining);
        }
    }),
    canvasGame({ id: 'snake', name: 'Snake', icon: 'activity', art: 'images/game-art/snake-cover-neon-cyberpunk-friendly-v8.webp', desc: 'Grow and avoid yourself!', load: () => import('../games/snake.js'), exportName: 'Snake', create: standardCanvasFactory }),
    canvasGame({ id: 'flappy-bird', name: 'Flappy Bird', icon: 'send', art: 'images/game-art/flappy-bird-cover-neon-cyberpunk-readable-v2.webp', desc: 'Fly through pipes!', load: () => import('../games/flappyBird.js'), exportName: 'FlappyBird', create: standardCanvasFactory }),
    canvasGame({ id: 'space-invaders', name: 'Space Invaders', icon: 'scan-face', art: 'images/game-art/space-invaders-cover-neon-cyberpunk-v1.webp', desc: 'Defend Earth!', load: () => import('../games/spaceInvaders.js'), exportName: 'SpaceInvaders', create: standardCanvasFactory }),
    canvasGame({ id: 'target-shooter', name: 'Target Shooter', icon: 'compass', art: 'images/game-art/target-shooter-cover-neon-cyberpunk-v1.webp', desc: 'Hit the targets!', load: () => import('../games/targetShooter.js'), exportName: 'TargetShooter', create: standardCanvasFactory }),
    canvasGame({ id: 'pong', name: 'Pong', icon: 'repeat-2', art: 'images/game-art/pong-cover-neon-cyberpunk-v1.webp', desc: 'Use W/S keys to move!', load: () => import('../games/pong.js'), exportName: 'Pong', create: standardCanvasFactory }),
    canvasGame({ id: 'whack-a-mole', name: 'Whack-a-Mole', icon: 'timer', art: 'images/game-art/whack-a-mole-cover-neon-cyberpunk-v1.webp', desc: 'Whack the moles!', load: () => import('../games/whackAMole.js'), exportName: 'WhackAMole', create: standardCanvasFactory }),
    htmlGame({ id: 'trapdoor-trials', name: 'Trapdoor Trials', icon: 'log-out', art: 'images/game-art/trapdoor-trials-cover-neon-cyberpunk-v1.webp', desc: 'Outsmart every surprise trap!', path: 'js/games/trapdoor-trials/index.html', scoreMessageType: 'trapdoor-trials-score', frame: { width: 960, height: 540, overflow: 'hidden', injectScoreMonitor: false } }),
    htmlGame({ id: 'tilt-maze', name: 'Tilt Maze', icon: 'layout-grid', art: 'images/game-art/tilt-maze-cover-neon-cyberpunk-v1.webp', desc: 'Tilt a 3D maze to reach the goal!', path: 'js/games/tilt-maze/index.html', scoreMessageType: 'tilt-maze-score', frame: { responsive: true, height: 600 } }),
    htmlGame({ id: 'basic-platformer', name: 'Circuit Sprint', icon: 'timer', art: 'images/game-art/circuit-sprint-cover-neon-cyberpunk-v1.webp', desc: 'Run the checkpoint course and chase a clean time!', path: 'js/games/basic-platformer/index.html', scoreMessageType: 'basic-platformer-score', frame: { width: 1280, height: 720, overflow: 'hidden' } }),
    htmlGame({ id: 'tower-platformer', name: 'Tower Climb', icon: 'layers-3', art: 'images/game-art/tower-climb-cover-neon-cyberpunk-v1.webp', desc: 'Circle the tower, climb ladders, and collect coins!', path: 'js/games/tower-platformer/index.html', scoreMessageType: 'tower-platformer-score', frame: { responsive: true, height: 600 } }),
    htmlGame({ id: 'radius-raid', name: 'Radius Raid', icon: 'send', art: 'images/game-art/radius-raid-cover-neon-cyberpunk-v1.webp', desc: 'Blast enemies in space!', path: 'js/games/radius-raid-master/index.html', scoreMessageType: 'radius-raid-score', frame: { width: 820, height: 620, overflow: 'auto' } }),
    htmlGame({ id: 'packabunchas', name: 'Packabunchas', icon: 'puzzle', art: 'images/game-art/packabunchas-cover-neon-cyberpunk-v1.webp', desc: 'Solve tiling puzzles!', path: 'js/games/packabunchas-main/index.html', scoreMessageType: 'packabunchas-score', frame: { width: 800, height: 600 } }),
    htmlGame({ id: 'spacepi', name: 'SpacePi', icon: 'badge-check', art: 'images/game-art/spacepi-cover-neon-cyberpunk-v1.webp', desc: 'Defend your base!', path: 'js/games/spacepi-master/index.html', scoreMessageType: 'spacepi-score', frame: { width: 960, height: 600, overflow: 'auto' } }),
    htmlGame({ id: 'black-hole-square', name: 'Black Hole Square', icon: 'circle-x', art: 'images/game-art/black-hole-square-cover-neon-cyberpunk-v1.webp', desc: 'Clean up the squares!', path: 'js/games/black-hole-square-master/public/index.html', frame: { responsive: true, height: 600 } }),
    htmlGame({ id: 'glitch-buster', name: 'Glitch Buster', icon: 'triangle-alert', art: 'images/game-art/glitch-buster-cover-neon-cyberpunk-v1.webp', desc: 'Bust the glitches!', path: 'js/games/glitch-buster-master/glitch buster.html', frame: { responsive: true, height: 600 } }),
    htmlGame({ id: 'callisto', name: 'Callisto', icon: 'sparkles', art: 'images/game-art/callisto-cover-neon-cyberpunk-v1.webp', desc: 'Run, jump, and collect stars in space!', path: 'js/games/js13k-callisto-main/index.html', frame: { responsive: true, height: 600 } }),
    htmlGame({ id: 'js13k2021', name: 'JS13K 2021', icon: 'gamepad-2', art: 'images/game-art/js13k2021-cover-neon-cyberpunk-v1.webp', desc: 'Leap across space platforms and collect orbs!', path: 'js/games/galaxy_rider.html', frame: { responsive: true, height: 600 } }),
    htmlGame({ id: 'my-digital-garden', name: 'My Magical Garden', icon: 'sparkles', art: 'images/game-art/my-magical-garden-cover-neon-cyberpunk-v1.webp', desc: 'Breed flowers and fill the garden!', path: 'js/games/my-digital-garden/index.html', frame: { responsive: true, height: 900 } }),
    htmlGame({ id: 'grow-your-garden', name: 'Grow Your Garden', icon: 'lightbulb', art: 'images/game-art/grow-your-garden-cover-neon-cyberpunk-v1.webp', desc: 'Plant, harvest, and upgrade your garden!', path: 'js/games/grow-your-garden/index.html', frame: { responsive: true, height: 900 } })
].map(game => Object.freeze(game)));

const GAME_BY_ID = new Map(STUDENT_GAME_REGISTRY.map(game => [game.id, game]));

export function getStudentGame(gameId) {
    return GAME_BY_ID.get(gameId) || null;
}

export function getLeaderboardGameIds() {
    return STUDENT_GAME_REGISTRY.filter(game => game.leaderboard).map(game => game.id);
}
