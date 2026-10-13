import assert from 'node:assert/strict';
import test from 'node:test';

import { createUniqueId, shuffled, shuffleInPlace } from '../js/randomUtils.js';

test('shuffleInPlace uses Fisher-Yates and returns the same array', () => {
    const values = ['a', 'b', 'c', 'd'];
    const randomValues = [0.25, 0.5, 0];
    const result = shuffleInPlace(values, () => randomValues.shift());

    assert.equal(result, values);
    assert.deepEqual(values, ['c', 'a', 'd', 'b']);
});

test('shuffled preserves the input array', () => {
    const source = [1, 2, 3];
    const result = shuffled(source, () => 0);

    assert.deepEqual(source, [1, 2, 3]);
    assert.deepEqual(result, [2, 3, 1]);
});

test('createUniqueId preserves prefixes and prefers randomUUID', () => {
    const id = createUniqueId('activity-progress:', {
        randomUUID: () => '12345678-1234-4123-8123-123456789abc'
    });

    assert.equal(id, 'activity-progress:12345678-1234-4123-8123-123456789abc');
});

test('createUniqueId creates an RFC 4122 version 4 ID from secure random bytes', () => {
    const id = createUniqueId('', {
        getRandomValues(bytes) {
            bytes.fill(0xab);
            return bytes;
        }
    });

    assert.equal(id, 'abababab-abab-4bab-abab-abababababab');
});

test('createUniqueId remains unique when Web Crypto is unavailable', () => {
    const first = createUniqueId('fallback-', null);
    const second = createUniqueId('fallback-', null);

    assert.notEqual(first, second);
    assert.match(first, /^fallback-[a-z0-9]+-[a-z0-9]+$/);
});
