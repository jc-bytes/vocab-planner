import {
    array,
    check,
    literal,
    looseObject,
    maxLength,
    pipe,
    safeParse,
    string,
    tuple
} from 'valibot';

import { readStudentJson, writeStudentJson } from './persistence/studentStorage.js';

const GAME_STORAGE_PREFIX = 'vocab-game-storage:';
const MAX_GAME_STORAGE_ENTRIES = 250;
const MAX_GAME_STORAGE_SIZE = 1_000_000;

const gameStorageEntriesSchema = pipe(
    array(tuple([string(), string()])),
    maxLength(MAX_GAME_STORAGE_ENTRIES),
    check(
        entries => entries.reduce((size, [key, value]) => size + key.length + value.length, 0)
            <= MAX_GAME_STORAGE_SIZE,
        'Sandboxed game storage is too large'
    )
);

const gameStorageMessageSchema = looseObject({
    type: literal('vocab-game-storage'),
    gameId: string(),
    channel: string(),
    entries: gameStorageEntriesSchema
});

export function readSandboxGameStorage(gameId, ownerUserId, options = {}) {
    return readStudentJson(`game-storage:${gameId}`, [], {
        owner: ownerUserId,
        legacyKeys: [`${GAME_STORAGE_PREFIX}${gameId}`],
        validate: value => {
            const result = safeParse(gameStorageEntriesSchema, value);
            return result.success ? result.output : null;
        },
        storage: options.storage
    });
}

export function persistSandboxGameStorage(data, expected, options = {}) {
    const result = safeParse(gameStorageMessageSchema, data);
    if (!result.success
        || result.output.gameId !== expected.gameId
        || result.output.channel !== expected.channel) return false;

    try {
        writeStudentJson(`game-storage:${expected.gameId}`, result.output.entries, {
            owner: expected.ownerUserId,
            storage: options.storage
        });
        return true;
    } catch (error) {
        console.warn(`Could not persist sandboxed storage for ${expected.gameId}:`, error);
        return false;
    }
}
