import {
    boolean,
    finite,
    looseObject,
    maxValue,
    minValue,
    number,
    pipe,
    safeParse,
    string
} from 'valibot';

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

const finiteNumberSchema = pipe(number(), finite());
const gameHostMessageSchema = looseObject({
    type: string(),
    score: pipe(finiteNumberSchema, minValue(0), maxValue(MAX_GAME_SCORE)),
    gameOver: boolean()
});

export function parseGameHostMessage(data, expectedType) {
    if (!expectedType) return null;
    const result = safeParse(gameHostMessageSchema, data);
    if (!result.success || result.output.type !== expectedType) return null;

    const metadata = {};
    NUMERIC_METADATA_FIELDS.forEach(field => {
        if (typeof result.output[field] === 'number' && Number.isFinite(result.output[field])) {
            metadata[field] = result.output[field];
        }
    });
    if (typeof result.output.completed === 'boolean') metadata.completed = result.output.completed;

    return {
        event: result.output.gameOver ? GAME_HOST_EVENT.GAME_OVER : GAME_HOST_EVENT.SCORE,
        score: result.output.score,
        metadata
    };
}
