import assert from 'node:assert/strict';
import test from 'node:test';

import {
    STUDENT_GAME_REGISTRY,
    getLeaderboardGameIds
} from '../js/student/studentGameRegistry.js';
import {
    extractSqlStringArray,
    findLatestFunctionDefinition
} from './helpers/sql-migration-functions.mjs';

function extractLowerIsBetterGameIds(definition, filename) {
    const matches = [...definition.matchAll(/lower_is_better\s*:=\s*game_id\s*=\s*'([^']+)'\s*;/gi)];
    if (matches.length !== 1) {
        throw new Error(`${filename} must expose one readable lower-is-better score policy`);
    }
    return [matches[0][1]];
}

test('client leaderboard capabilities remain authorized by the effective score RPC', async () => {
    const scoreFunction = await findLatestFunctionDefinition(
        'private.submit_student_game_score',
        /^p_game_id text, p_score numeric, p_metadata jsonb default '\{\}'::jsonb$/i,
        /^text, numeric, jsonb$/i
    );
    const allowedIds = extractSqlStringArray(
        scoreFunction.definition,
        /allowed_games\s+constant\s+text\[\]\s*:=\s*array\s*\[([\s\S]*?)\]\s*;/i,
        'allowed leaderboard games',
        scoreFunction.filename
    );
    const lowerIsBetterIds = extractLowerIsBetterGameIds(scoreFunction.definition, scoreFunction.filename);
    const leaderboardIds = getLeaderboardGameIds();

    assert.deepEqual(
        [...allowedIds].sort(),
        [...leaderboardIds].sort(),
        `Client leaderboard capabilities differ from server score authority in ${scoreFunction.filename}`
    );
    assert.deepEqual(
        lowerIsBetterIds.filter(gameId => !leaderboardIds.includes(gameId)),
        [],
        `Lower-is-better games in ${scoreFunction.filename} must expose a client leaderboard`
    );

    const lowerIsBetterSet = new Set(lowerIsBetterIds);
    for (const gameId of allowedIds) {
        const descriptor = STUDENT_GAME_REGISTRY.find(game => game.id === gameId);
        const expectedOrder = lowerIsBetterSet.has(gameId) ? 'asc' : 'desc';
        assert.equal(
            descriptor.scoreOrder,
            expectedOrder,
            `${gameId} score order differs from ${scoreFunction.filename}`
        );
    }
});
