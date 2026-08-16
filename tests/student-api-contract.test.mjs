import assert from 'node:assert/strict';
import test from 'node:test';
import { STUDENT_API_METHODS, studentApi } from '../js/services/studentApi.js';
import { supabaseService } from '../js/supabaseService.js';

const EXPECTED_STUDENT_METHODS = [
    'acceptStudentGiftCoins',
    'buildWordHuntImagePath',
    'claimStudentWelcomeBonus',
    'downloadWordHuntImage',
    'ensureOwnStudentProgress',
    'getOwnArcadeTime',
    'getProfile',
    'handleRedirectResult',
    'init',
    'onAuthStateChanged',
    'signInWithPassword',
    'signOut',
    'signUpStudent',
    'spendStudentCoins',
    'startStudentActivityAttempt',
    'startStudentArcadeMinute',
    'submitStudentActivityProgress',
    'submitStudentGameScore',
    'submitStudentSparkResponse',
    'syncStudentUnitWork',
    'updatePasswordAndClearFlag',
    'updateStudentProfile',
    'uploadWordHuntImage'
];

test('student API exposes only the explicit student surface', () => {
    assert.deepEqual([...STUDENT_API_METHODS].sort(), EXPECTED_STUDENT_METHODS);
    assert.deepEqual(Object.keys(studentApi).sort(), EXPECTED_STUDENT_METHODS);
    assert.ok(Object.values(studentApi).every(value => typeof value === 'function'));
    assert.equal(Object.isFrozen(studentApi), true);
});

test('student API does not expose teacher or raw-client operations', () => {
    for (const method of [
        'createStudentAccount',
        'ensureAllowlistedTeacherProfile',
        'getClient',
        'getStudentsWithProgress',
        'giftStudentCoins',
        'resetStudentPassword',
        'signUpTeacher'
    ]) {
        assert.equal(method in studentApi, false, `${method} must stay outside the student API`);
    }
});

test('student API delegates with the shared service as its receiver', async () => {
    const original = supabaseService.getProfile;
    let receiver = null;
    supabaseService.getProfile = function getProfileFixture(userId) {
        receiver = this;
        return Promise.resolve({ userId });
    };

    try {
        assert.deepEqual(await studentApi.getProfile('student-1'), { userId: 'student-1' });
        assert.equal(receiver, supabaseService);
    } finally {
        supabaseService.getProfile = original;
    }
});
