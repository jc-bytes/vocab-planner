import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

const clip = (value, limit = 120) => String(value).slice(0, limit);
function describe(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return `array(length=${value.length})`;
    if (typeof value === 'string') return `string(length=${value.length}, value=${JSON.stringify(clip(value, 80))})`;
    if (typeof value === 'object') return `object(keys=${Reflect.ownKeys(value).length})`;
    return `${typeof value}(${clip(value, 80)})`;
}

// Equivalence always uses the complete values, including types and array order.
// Locate only the first differing JSON field for diagnostics. Node's default
// AssertionError diff can allocate gigabytes when one large result is an error.
export function assertRehearsalJsonEqual(actual, expected, label = 'Rehearsal JSON') {
    if (isDeepStrictEqual(actual, expected)) return;
    let left = actual, right = expected, path = '$';
    for (let depth = 0; depth < 24; depth++) {
        if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object'
            || Array.isArray(left) !== Array.isArray(right)) break;
        const leftKeys = Reflect.ownKeys(left), rightKeys = Reflect.ownKeys(right);
        const differing = leftKeys.find(key => !Object.hasOwn(right, key) || !isDeepStrictEqual(left[key], right[key]));
        const key = differing ?? rightKeys.find(candidate => !Object.hasOwn(left, candidate));
        if (key === undefined) break; // A prototype difference is still unequal.
        path += `[${JSON.stringify(clip(key, 80))}]`;
        left = left[key]; right = right[key];
    }
    assert.fail(`${clip(label)}: exact JSON mismatch at ${clip(path, 240)}; actual ${describe(left)}; expected ${describe(right)}.`);
}
