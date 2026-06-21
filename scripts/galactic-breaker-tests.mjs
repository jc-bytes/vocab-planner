import assert from 'node:assert/strict';
import { GalacticBreaker } from '../js/games/galacticBreaker.js';

const noop = () => {};

globalThis.document = {
    addEventListener: noop,
    removeEventListener: noop
};

function createCanvas() {
    return {
        width: 800,
        height: 600,
        style: {},
        addEventListener: noop,
        removeEventListener: noop,
        getBoundingClientRect: () => ({ left: 0, right: 800, top: 0, bottom: 600, width: 800, height: 600 }),
        getContext: () => ({})
    };
}

let remainingSeconds = 60;
const reportedScores = [];
const game = new GalacticBreaker(
    createCanvas(),
    noop,
    score => reportedScores.push(score),
    () => remainingSeconds
);

assert.equal(game.brickRowCount, 4, 'The opening board should fit a one-minute session.');
assert.equal(game.bricks.flat().length, 36, 'The opening board should contain four rows of nine bricks.');

const bottomRowTypes = game.bricks.map(column => column[game.brickRowCount - 1].type);
assert.ok(bottomRowTypes.includes(3), 'The lower row should guarantee an explosive brick.');
assert.ok(bottomRowTypes.includes(4), 'The lower row should guarantee a multiball brick.');
assert.ok(bottomRowTypes.includes(5), 'The lower row should guarantee a power-up brick.');

const requiredHits = game.bricks.flat().reduce((total, brick) => total + brick.hits, 0);
assert.equal(requiredHits, 45, 'The opening board should be achievable without removing all challenge.');

game.combo = 0;
assert.equal(game.getComboMultiplier(), 1);
game.combo = 4;
assert.equal(game.getComboMultiplier(), 2);
game.combo = 40;
assert.equal(game.getComboMultiplier(), 5, 'The combo multiplier should be capped.');

game.combo = 4;
remainingSeconds = 11;
assert.equal(game.getScoreMultiplier(), 2, 'Normal play should use only the combo multiplier.');
remainingSeconds = 10;
assert.equal(game.getScoreMultiplier(), 4, 'The final ten seconds should double the combo multiplier.');

game.score = 0;
game.combo = 0;
remainingSeconds = 60;
for (let i = 0; i < 5; i++) game.addBrickScore(10);
assert.equal(game.score, 60, 'The fifth consecutive brick should earn the x2 combo rate.');
assert.equal(game.combo, 5);
game.resetCombo();
assert.equal(game.combo, 0, 'Missing the last ball should reset the combo.');

game.score = 0;
game.lives = 3;
game.completeMinute();
assert.equal(game.score, 150, 'Each remaining life should award 50 points at a minute boundary.');
assert.equal(reportedScores.at(-1), 150, 'Minute bonuses should immediately reach the leaderboard score state.');

assert.deepEqual(
    game.powerUpTypes.map(powerUp => powerUp.type),
    ['expand', 'slow', 'multiball', 'fireball'],
    'Short sessions should only drop immediately useful power-ups.'
);

game.stop();

console.log('Galactic Breaker tests passed.');
