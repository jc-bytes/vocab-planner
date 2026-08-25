export const GAME_HOST_EVENT = Object.freeze({
    SCORE: 'score',
    GAME_OVER: 'game-over'
});

const NUMERIC_METADATA_FIELDS = Object.freeze([
    'level',
    'deaths',
    'totalDeaths',
    'completedLevels',
    'totalLevels',
    'time',
    'attempts',
    'originalScore'
]);

const MAX_GAME_SCORE = 100_000_000;

export function parseGameHostMessage(data, expectedType) {
    if (!expectedType || !data || typeof data !== 'object' || data.type !== expectedType) {
        return null;
    }
    if (typeof data.score !== 'number'
        || !Number.isFinite(data.score)
        || data.score < 0
        || data.score > MAX_GAME_SCORE
        || typeof data.gameOver !== 'boolean') return null;

    const metadata = {};
    NUMERIC_METADATA_FIELDS.forEach(field => {
        if (typeof data[field] === 'number' && Number.isFinite(data[field])) {
            metadata[field] = data[field];
        }
    });
    if (typeof data.completed === 'boolean') metadata.completed = data.completed;

    return {
        event: data.gameOver ? GAME_HOST_EVENT.GAME_OVER : GAME_HOST_EVENT.SCORE,
        score: data.score,
        metadata
    };
}
