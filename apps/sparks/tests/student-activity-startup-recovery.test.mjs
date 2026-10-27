import assert from 'node:assert/strict';
import test from 'node:test';
import { StudentActivityAttemptService } from '../js/student/studentActivityAttemptService.js';
import { supabaseService } from '../js/supabaseService.js';

function attemptFixture() {
    const session = { activityAttempt: null, activityLaunchId: 1 };
    const vocab = { id: 'vocab-original' };
    const sm = { currentUser: { uid: 'student-1' }, currentVocab: vocab };
    const activities = { session, sm, getUnitProgressKey: value => `assignment:${value.id}` };
    return { service: new StudentActivityAttemptService({ activities, sm }), session, sm };
}

test('verified startup retries a settled transient failure once using the original unit', async t => {
    const { service, sm, session } = attemptFixture();
    const requests = [], owners = [];
    t.mock.method(supabaseService, 'startStudentActivityAttempt', async (payload, options) => {
        requests.push(payload);
        owners.push(options.ownerUserId);
        if (requests.length === 1) throw { status: 503, code: 'TEMPORARY', message: 'Unavailable' };
        return { attemptId: 'verified-1' };
    });
    const result = await service.startVerifiedActivityAttempt('flashcards', { retryDelayMs: 0 });
    assert.equal(result.attemptId, 'verified-1');
    assert.equal(session.activityAttempt, result);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(request => request.vocabularyId === sm.currentVocab.id));
    assert.deepEqual(owners, ['student-1', 'student-1']);
});

test('verified startup never retries a permission denial', async t => {
    const { service } = attemptFixture();
    let calls = 0;
    t.mock.method(supabaseService, 'startStudentActivityAttempt', async () => {
        calls++; throw { code: '42501', message: 'Assignment is not accepting work.' };
    });
    await assert.rejects(service.startVerifiedActivityAttempt('flashcards'), error => error.code === '42501');
    assert.equal(calls, 1);
});

test('an older verification cannot overwrite the new activity attempt', async t => {
    const { service, session } = attemptFixture();
    let release;
    t.mock.method(supabaseService, 'startStudentActivityAttempt', () => new Promise(resolve => { release = resolve; }));
    const old = service.startVerifiedActivityAttempt('flashcards');
    session.activityLaunchId++;
    session.activityAttempt = { attemptId: 'new-current-attempt' };
    release({ attemptId: 'old-attempt' });
    await old;
    assert.equal(session.activityAttempt.attemptId, 'new-current-attempt');
});

test('actual installed attempt method preserves HTTP 503 for bounded retry', async t => {
    const { installSupabaseStudentWriteMethods } = await import('../js/supabaseStudentWriteMethods.js');
    const { service, session } = attemptFixture();
    let calls = 0;
    const backend = { async init() {}, client: { async rpc() {
        calls++;
        return calls === 1 ? { status: 503, error: { code: 'PGRST000', message: 'Database unavailable' } }
            : { status: 200, data: { attemptId: 'http-recovered' } };
    } } };
    installSupabaseStudentWriteMethods(backend);
    t.mock.method(supabaseService, 'startStudentActivityAttempt', (payload, options) => backend.startStudentActivityAttempt(payload, options));
    await service.startVerifiedActivityAttempt('flashcards', { retryDelayMs: 0 });
    assert.equal(calls, 2);
    assert.equal(session.activityAttempt.attemptId, 'http-recovered');
});

test('canceling during verification retry prevents a second request or old attempt assignment', async t => {
    const { service, session } = attemptFixture();
    const controller = new AbortController();
    let calls = 0;
    t.mock.method(supabaseService, 'startStudentActivityAttempt', async () => {
        calls++; controller.abort(); throw Object.assign(new Error('Failed to fetch'), { code: 'NETWORK_ERROR' });
    });
    await assert.rejects(service.startVerifiedActivityAttempt('flashcards', { signal: controller.signal }), { code: 'REQUEST_ABORTED' });
    assert.equal(calls, 1);
    assert.equal(session.activityAttempt, null);
});

test('unit selection changing during retry stops the old verification', async t => {
    const { service, sm, session } = attemptFixture();
    let calls = 0;
    t.mock.method(supabaseService, 'startStudentActivityAttempt', async () => {
        calls++;
        sm.currentVocab = { id: 'different-unit' };
        throw Object.assign(new Error('Failed to fetch'), { code: 'NETWORK_ERROR' });
    });
    await assert.rejects(service.startVerifiedActivityAttempt('flashcards', { retryDelayMs: 0 }), { code: 'REQUEST_ABORTED' });
    assert.equal(calls, 1);
    assert.equal(session.activityAttempt, null);
});
