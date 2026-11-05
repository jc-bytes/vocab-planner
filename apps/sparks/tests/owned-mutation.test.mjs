import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { runOwnedMutation } from '../js/services/ownedMutation.js';
import { createClassroomRepository } from '../js/services/classroomRepository.js';
import { createSchoolRepository } from '../js/services/schoolRepository.js';
import { createTeacherGroupRestrictionsRepository } from '../js/services/teacherGroupRestrictionsRepository.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const session = id => ({ user: { id }, access_token: `token-${id}` });
function fixture() {
    let actor = 'teacher-a', generation = 1, schoolGeneration = 1;
    const requests = [];
    const client = createClient('https://owned-mutation.invalid', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: async (url, options) => {
            const headers = new Headers(options.headers);
            requests.push({ url, owner: headers.get('Authorization'), body: options.body && JSON.parse(options.body) });
            return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
        } }
    });
    client.auth.getSession = async () => ({ data: { session: session(actor) }, error: null });
    const ownership = { getIdentity: () => ({ userId: actor, generation }), context: { getGeneration: () => schoolGeneration } };
    return { client, requests, ownership,
        replace(id = 'teacher-b') { actor = id; generation++; }, switchSchool() { schoolGeneration++; } };
}

test('actual SDK pins only the initiating mutation while a shared co-teacher replaces its token lookup', async () => {
    const f = fixture(), tokenLookup = deferred(), release = deferred();
    let lookups = 0;
    f.client.auth.getSession = async () => {
        if (++lookups === 1) return { data: { session: session('teacher-a') }, error: null };
        if (lookups === 2) { tokenLookup.resolve(); await release.promise; }
        return { data: { session: session('teacher-b') }, error: null };
    };
    const repo = createClassroomRepository(() => f.client, () => 'school-a', f.ownership);
    const pending = repo.saveStudentFeedback({ assignmentId: 'shared-assignment', studentId: 'student', note: 'A note' });
    await tokenLookup.promise;
    f.replace(); release.resolve();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(f.requests.length, 1, 'A dispatched request can still commit under its original actor');
    assert.equal(f.requests[0].owner, 'Bearer token-teacher-a');
    assert.equal(f.requests[0].body.p_note, 'A note');
    await f.client.rpc('unrelated_read', {});
    assert.equal(f.requests[1].owner, 'Bearer token-teacher-b', 'no shared client headers were changed');
    assert.equal(f.client.rest.headers.get('Authorization'), null);
});

test('replacement during executor session acquisition rejects before any request', async () => {
    const f = fixture(), started = deferred(), release = deferred();
    f.client.auth.getSession = async () => { started.resolve(); await release.promise; return { data: { session: session('teacher-b') }, error: null }; };
    const repo = createSchoolRepository(() => f.client, () => null, f.ownership);
    const pending = repo.setMember('school-a', 'student', ['teacher']);
    await started.promise; f.replace(); release.resolve();
    await assert.rejects(pending, { name: 'AbortError' }); assert.equal(f.requests.length, 0);
});

test('an explicit UI actor rejects a different resolved session without an injected identity provider', async () => {
    const f = fixture(); f.replace();
    const repo = createClassroomRepository(() => f.client, () => 'school-a');
    await assert.rejects(repo.withdrawAssignment('assignment-a', { ownerUserId: 'teacher-a' }), { name: 'AbortError' });
    assert.equal(f.requests.length, 0);
});

test('account, same-account generation, school, UI and signal replacements stop held initialization', async t => {
    for (const replacement of ['account', 'generation', 'school', 'ui', 'signal']) await t.test(replacement, async () => {
        const f = fixture(), release = deferred(), controller = new AbortController(); let current = true;
        const pending = runOwnedMutation(() => release.promise, client => client.from('vocabularies').delete().eq('id', 'a'), {
            ...f.ownership, signal: controller.signal, isCurrent: () => current
        });
        if (replacement === 'account') f.replace();
        if (replacement === 'generation') f.replace('teacher-a');
        if (replacement === 'school') f.switchSchool();
        if (replacement === 'ui') current = false;
        if (replacement === 'signal') controller.abort();
        release.resolve(f.client);
        await assert.rejects(pending, { name: 'AbortError' }); assert.equal(f.requests.length, 0);
    });
});

test('positive classroom, school and group mutations retain payloads/results and actor headers', async () => {
    const f = fixture(), repo = createClassroomRepository(() => f.client, () => 'school-a', f.ownership);
    assert.deepEqual(await repo.createClass({ name: '  6A  ', subjectId: 'subject', schoolYear: '2026' }), { ok: true });
    assert.deepEqual(await repo.setClassArchived('class', true), { ok: true });
    const school = createSchoolRepository(() => f.client, () => null, f.ownership);
    assert.deepEqual(await school.inviteMember('school-a', ' Teacher@example.com ', ['teacher']), { ok: true });
    const groups = createTeacherGroupRestrictionsRepository(() => f.client, () => 'school-a', f.ownership);
    await groups.remove('group');
    assert.equal(f.requests.length, 4); assert.ok(f.requests.every(request => request.owner === 'Bearer token-teacher-a'));
    assert.equal(f.requests[0].body.p_name, '6A'); assert.equal(f.requests[0].body.p_school_year, 2026);
    assert.deepEqual(f.requests[1].body, { archived: true });
});

test('write arguments are captured before initialization and server errors retain status', async () => {
    const f = fixture(), release = deferred();
    const repo = createClassroomRepository(() => release.promise, () => 'school-a', f.ownership);
    const args = { classIds: ['class-a'], kind: 'vocabulary', materialId: 'v', releaseAt: '2026-01-01', publicationKey: 'key' };
    const pending = repo.publishMaterial(args); args.classIds.push('class-b'); release.resolve(f.client); await pending;
    assert.deepEqual(f.requests[0].body.p_class_ids, ['class-a']);
    const errorClient = createClient('https://owned-mutation.invalid', 'key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: async () => new Response(JSON.stringify({ code: '42501', message: 'Denied' }), { status: 403 }) }
    });
    errorClient.auth.getSession = async () => ({ data: { session: session('teacher-a') }, error: null });
    await assert.rejects(runOwnedMutation(() => errorClient, client => client.rpc('denied', {}), f.ownership),
        error => error.code === '42501' && error.status === 403);
});

test('signed-out production identities and unavailable sessions cannot become future-account writes', async () => {
    const f = fixture(); let accessed = false;
    await assert.rejects(runOwnedMutation(() => { accessed = true; return f.client; }, client => client.rpc('write', {}), {
        getIdentity: () => ({ userId: null, generation: 0 })
    }), { name: 'AbortError' });
    assert.equal(accessed, false);
    f.client.auth.getSession = async () => ({ data: { session: null }, error: null });
    await assert.rejects(runOwnedMutation(() => f.client, client => client.rpc('write', {}), f.ownership), { name: 'AbortError' });
    assert.equal(f.requests.length, 0);
});

test('session refresh keeps the same login while a replaced login session is rejected', async () => {
    const token = id => `header.${Buffer.from(JSON.stringify({ session_id: id })).toString('base64url')}.signature`;
    for (const replacement of [false, true]) {
        const f = fixture();
        const identitySession = { user: { id: 'teacher-a' }, access_token: token('login-a') };
        f.client.auth.getSession = async () => ({ data: { session: { user: { id: 'teacher-a' }, access_token: token(replacement ? 'login-b' : 'login-a') } }, error: null });
        const pending = runOwnedMutation(() => f.client, client => client.rpc('write', {}), {
            getIdentity: () => ({ userId: 'teacher-a', generation: 1, session: identitySession })
        });
        if (replacement) { await assert.rejects(pending, { name: 'AbortError' }); assert.equal(f.requests.length, 0); }
        else { assert.deepEqual(await pending, { ok: true }); assert.equal(f.requests.length, 1); }
    }
});

test('all wallet mutations pin their initiating actor without changing receipt payloads', async () => {
    const { studentWriteOperations } = await import('../js/supabaseStudentWriteOperations.js');
    for (const method of ['spendStudentCoins', 'acceptStudentGiftCoins', 'claimStudentWelcomeBonus', 'giftStudentCoins']) {
        const f = fixture();
        const service = { currentUser: { uid: 'teacher-a' }, authIdentityGeneration: 1, client: f.client };
        const payload = { eventId: 'original-receipt', amount: 7, studentId: 'student-a', clientId: 'original-client' };
        await studentWriteOperations[method].call(service, payload);
        assert.equal(f.requests[0].owner, 'Bearer token-teacher-a');
        assert.equal(f.requests[0].body.p_event_id, 'original-receipt');
        assert.equal('signal' in f.requests[0].body, false);
    }
});
