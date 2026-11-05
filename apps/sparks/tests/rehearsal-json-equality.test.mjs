import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRehearsalJsonEqual } from '../scripts/lib/rehearsalJsonEquality.mjs';

const result = () => ({ teacher: { selected: { status: 200, data: [{ userId: 'student', units: {
    'assignment:a': { nested: { nullable: null, ordered: [3, 1, 2] }, states: { matching: [{}, 3, 1, 2] } }
} }] } }, denied: { selected: { status: 403, error: { code: '42501', message: 'Denied' } } } });

test('complete equal matrices pass without modifying either result', () => {
    const expected = result(), actual = structuredClone(expected);
    Object.freeze(actual); Object.freeze(expected);
    assert.doesNotThrow(() => assertRehearsalJsonEqual(actual, expected));
    assert.deepEqual(actual, expected);
});

const cases = [
    ['array order', actual => { actual.teacher.selected.data[0].units['assignment:a'].nested.ordered = [1, 3, 2]; }, /ordered/],
    ['response status', actual => { actual.teacher.selected.status = 500; }, /status/],
    ['response data', actual => { actual.teacher.selected.data[0].userId = 'other-student'; }, /userId/],
    ['value type', actual => { actual.teacher.selected.data[0].units['assignment:a'].nested.nullable = undefined; }, /nullable/],
    ['missing request', actual => { delete actual.denied.selected; }, /selected/],
    ['extra role', actual => { actual.extra = { status: 200 }; }, /extra/],
    ['error code', actual => { actual.denied.selected.error.code = '57014'; }, /code/]
];
for (const [name, change, path] of cases) test(`${name} remains an exact-equivalence failure`, () => {
    const expected = result(), actual = structuredClone(expected); change(actual);
    assert.throws(() => assertRehearsalJsonEqual(actual, expected, 'Controlled comparison'), error => {
        assert.match(error.message, /Controlled comparison: exact JSON mismatch/);
        assert.match(error.message, path); assert.ok(error.message.length < 1024);
        return error.code === 'ERR_ASSERTION';
    });
});

test('object key ordering is immaterial while array length and numeric types stay exact', () => {
    assert.doesNotThrow(() => assertRehearsalJsonEqual({ b: 2, a: [1, null] }, { a: [1, null], b: 2 }));
    for (const [actual, expected] of [[[], [null]], [[1], ['1']], [{ a: null }, {}], [Object.create(null), {}]]) {
        assert.throws(() => assertRehearsalJsonEqual(actual, expected), { code: 'ERR_ASSERTION' });
    }
});

test('a large success versus transport timeout fails with a bounded case path without formatting payloads', () => {
    const secret = 'PAYLOAD_MUST_NOT_APPEAR_IN_DIAGNOSTIC';
    const expected = { assigned_teacher: { exact_limit: { status: 200,
        data: Array.from({ length: 10000 }, (_, i) => ({ student: i, work: secret.repeat(8), order: [3, 1, 2] })) } } };
    const actual = { assigned_teacher: { exact_limit: { status: 500, error: { code: '57014', message: 'Statement timeout' } } } };
    assert.throws(() => assertRehearsalJsonEqual(actual, expected, 'SDK role matrix'), error => {
        assert.match(error.message, /assigned_teacher.*exact_limit.*status/);
        assert.match(error.message, /number\(500\).*number\(200\)/);
        assert.ok(error.message.length < 512);
        assert.equal(error.message.includes(secret), false);
        assert.equal(error.actual, undefined, 'The assertion must not retain the complete matrix');
        assert.equal(error.expected, undefined);
        return true;
    });
});

test('deep paths and labels are bounded independently of payload size', () => {
    const actual = {}, expected = {}; let a = actual, b = expected;
    for (let i = 0; i < 100; i++) { a['key'.repeat(100)] = {}; b['key'.repeat(100)] = {}; a = a['key'.repeat(100)]; b = b['key'.repeat(100)]; }
    a.value = 1; b.value = 2;
    assert.throws(() => assertRehearsalJsonEqual(actual, expected, 'label'.repeat(1000)), error => error.message.length < 512);
});
