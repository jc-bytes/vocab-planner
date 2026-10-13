import assert from 'node:assert/strict';
import test from 'node:test';
import { CancelledError, QueryClient } from '@tanstack/query-core';

import {
    SERVER_STATE_GC_TIME_MS,
    SERVER_STATE_STALE_TIME_MS,
    createServerStateQuery,
    serverStateQueryKey,
    shouldRetryServerStateRead
} from '../js/services/serverStateQuery.js';

function createHarness() {
    const queryClient = new QueryClient();
    return {
        queryClient,
        query: createServerStateQuery({ queryClient, gcTime: Infinity })
    };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

async function waitFor(predicate, attempts = 20) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (predicate()) return;
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.fail('Timed out waiting for the expected query state.');
}

test('server-state keys require an account and preserve array key parts', () => {
    assert.deepEqual(
        serverStateQueryKey('teacher-1', ['teacher', 'weekly-sparks']),
        ['server-state', 'teacher-1', 'teacher', 'weekly-sparks']
    );
    assert.throws(() => serverStateQueryKey(null, ['weekly-sparks']), /account ID/);
    assert.throws(() => serverStateQueryKey('teacher-1', 'weekly-sparks'), /must be arrays/);
    assert.equal(SERVER_STATE_STALE_TIME_MS, 60_000);
    assert.equal(SERVER_STATE_GC_TIME_MS, 600_000);
});

test('ensure deduplicates in-flight reads and reuses fresh data', async () => {
    const { queryClient, query } = createHarness();
    const pending = deferred();
    let fetchCount = 0;
    const options = {
        accountId: 'teacher-1',
        key: ['teacher', 'weekly-sparks'],
        staleTime: Infinity,
        queryFn: async () => {
            fetchCount += 1;
            return pending.promise;
        }
    };

    const first = query.ensure(options);
    const second = query.ensure(options);
    assert.equal(fetchCount, 1);
    pending.resolve([{ id: 'spark-1' }]);

    assert.deepEqual(await first, [{ id: 'spark-1' }]);
    assert.deepEqual(await second, [{ id: 'spark-1' }]);
    assert.deepEqual(await query.ensure(options), [{ id: 'spark-1' }]);
    assert.equal(fetchCount, 1);
    queryClient.clear();
});

test('invalidate marks matching data stale without fetching until ensure', async () => {
    const { queryClient, query } = createHarness();
    let fetchCount = 0;
    const options = {
        accountId: 'teacher-1',
        key: ['teacher', 'weekly-sparks'],
        staleTime: Infinity,
        queryFn: async () => [{ version: ++fetchCount }]
    };

    assert.deepEqual(await query.ensure(options), [{ version: 1 }]);
    await query.invalidate({
        accountId: 'teacher-1',
        key: ['teacher', 'weekly-sparks'],
        exact: true
    });
    assert.equal(fetchCount, 1);
    assert.deepEqual(await query.ensure(options), [{ version: 2 }]);
    queryClient.clear();
});

test('observe shares the cache, accepts pushed data, and cancels an orphaned read', async () => {
    const { queryClient, query } = createHarness();
    let requestSignal = null;
    const results = [];
    const observation = query.observe({
        accountId: 'student-1',
        key: ['student', 'progress-summary'],
        retry: false,
        queryFn: ({ signal }) => {
            requestSignal = signal;
            return new Promise(() => {});
        }
    }, result => results.push(result));

    await waitFor(() => requestSignal !== null);
    query.setData({
        accountId: 'student-1',
        key: ['student', 'progress-summary'],
        updater: { totalXp: 25 }
    });
    await waitFor(() => results.some(result => result.data?.totalXp === 25));

    assert.deepEqual(
        queryClient.getQueryData(serverStateQueryKey('student-1', ['student', 'progress-summary'])),
        { totalXp: 25 }
    );

    observation.unsubscribe();
    await waitFor(() => requestSignal.aborted);
    queryClient.clear();
});

test('refresh starts a new read and late cancelled data cannot replace it', async () => {
    const { queryClient, query } = createHarness();
    const requests = [];
    const options = {
        accountId: 'teacher-1',
        key: ['teacher', 'weekly-sparks'],
        retry: false,
        queryFn: () => {
            const request = deferred();
            requests.push(request);
            return request.promise;
        }
    };

    const older = query.ensure(options);
    const olderOutcome = older.then(
        value => ({ value }),
        error => ({ error })
    );
    await waitFor(() => requests.length === 1);
    const newer = query.refresh(options);
    await waitFor(() => requests.length === 2);
    assert.equal(requests.length, 2);

    requests[1].resolve([{ id: 'newer' }]);
    assert.deepEqual(await newer, [{ id: 'newer' }]);
    requests[0].resolve([{ id: 'older' }]);
    const cancelled = await olderOutcome;
    assert.equal(cancelled.error instanceof CancelledError, true);

    assert.deepEqual(
        queryClient.getQueryData(serverStateQueryKey('teacher-1', ['teacher', 'weekly-sparks'])),
        [{ id: 'newer' }]
    );
    queryClient.clear();
});

test('clearAccount removes only the selected account', async () => {
    const { queryClient, query } = createHarness();
    const read = accountId => query.ensure({
        accountId,
        key: ['teacher', 'weekly-sparks'],
        staleTime: Infinity,
        queryFn: async () => [{ accountId }]
    });

    await Promise.all([read('teacher-1'), read('teacher-2')]);
    await query.clearAccount('teacher-1');

    assert.equal(
        queryClient.getQueryData(serverStateQueryKey('teacher-1', ['teacher', 'weekly-sparks'])),
        undefined
    );
    assert.deepEqual(
        queryClient.getQueryData(serverStateQueryKey('teacher-2', ['teacher', 'weekly-sparks'])),
        [{ accountId: 'teacher-2' }]
    );
    queryClient.clear();
});

test('read retry policy retries transient failures once and rejects terminal failures', () => {
    assert.equal(shouldRetryServerStateRead(0, new TypeError('network unavailable')), true);
    assert.equal(shouldRetryServerStateRead(1, new TypeError('network unavailable')), false);
    assert.equal(shouldRetryServerStateRead(0, { status: 500 }), true);
    assert.equal(shouldRetryServerStateRead(0, { status: 429 }), true);
    assert.equal(shouldRetryServerStateRead(0, { status: 403 }), false);
    assert.equal(shouldRetryServerStateRead(0, new DOMException('aborted', 'AbortError')), false);
    assert.equal(shouldRetryServerStateRead(0, new CancelledError()), false);
});

async function schoolFixture(t) {
    const { schoolContext } = await import('../js/services/schoolContext.js');
    const { supabaseService } = await import('../js/supabaseService.js');
    t.mock.method(supabaseService, 'init', async () => {});
    t.mock.method(supabaseService, 'getClient', () => ({ rpc: () => ({
        abortSignal: () => Promise.resolve({ data: { schools: [
            { id: 'school-a', roles: ['teacher'] }, { id: 'school-b', roles: ['teacher'] }
        ] }, error: null })
    }) }));
    await schoolContext.load('teacher-1');
    t.after(() => schoolContext.clear());
    return schoolContext;
}

test('refresh cannot recreate old-school cache after a school switch clears the account', async (t) => {
    const school = await schoolFixture(t);
    const { queryClient, query } = createHarness();
    const unsubscribe = school.subscribe(() => { void query.clearAccount('teacher-1'); });
    t.after(() => { unsubscribe(); queryClient.clear(); });
    let calls = 0;
    const pending = query.refresh({ accountId: 'teacher-1', key: ['teacher', 'weekly-sparks'],
        queryFn: async () => { calls++; return { schoolId: school.getSchoolId() }; } });
    school.select('school-b');
    await assert.rejects(pending, error => error instanceof CancelledError);
    assert.equal(calls, 0);
    assert.equal(queryClient.getQueryCache().getAll().length, 0);
    const current = await query.ensure({ accountId: 'teacher-1', key: ['teacher', 'weekly-sparks'],
        queryFn: async () => ({ schoolId: school.getSchoolId() }) });
    assert.deepEqual(current, { schoolId: 'school-b' });
});

test('same-school generation and account replacement cancel pending results', async (t) => {
    const school = await schoolFixture(t);
    const { queryClient, query } = createHarness();
    t.after(() => queryClient.clear());
    for (const accountId of ['teacher-1', 'teacher-2']) {
        const pending = deferred();
        const key = serverStateQueryKey('teacher-1', ['teacher', 'library']);
        const reading = query.ensure({ accountId: 'teacher-1', key: ['teacher', 'library'],
            queryFn: () => pending.promise, retry: true });
        const outcome = assert.rejects(reading, error => error instanceof CancelledError);
        await school.load(accountId);
        pending.resolve({ oldSession: true });
        await outcome;
        assert.equal(queryClient.getQueryData(key), undefined);
    }
});

test('retry and observer refetch do not dispatch under a replacement school', async (t) => {
    const school = await schoolFixture(t);
    const { queryClient, query } = createHarness();
    t.after(() => queryClient.clear());
    let calls = 0;
    const reading = query.ensure({ accountId: 'teacher-1', key: ['teacher', 'retry'], retry: true, retryDelay: 0,
        queryFn: async () => { calls++; throw new TypeError('Failed to fetch'); } });
    school.select('school-b');
    await assert.rejects(reading, error => error instanceof CancelledError);
    assert.equal(calls, 1);
    const pending = deferred();
    const oldKey = serverStateQueryKey('teacher-1', ['teacher', 'observed']);
    const successes = [];
    const observed = query.observe({ accountId: 'teacher-1', key: ['teacher', 'observed'], retry: true,
        queryFn: () => { calls++; return pending.promise; } }, result => { if (result.isSuccess) successes.push(result.data); });
    school.select('school-a');
    pending.resolve({ fromSchool: 'school-b' });
    await waitFor(() => queryClient.getQueryCache().find({ queryKey: oldKey, exact: true })?.state.fetchStatus === 'idle');
    await observed.refetch();
    assert.equal(calls, 2, 'A stale observer cannot issue another school request');
    assert.deepEqual(successes, []);
    assert.equal(queryClient.getQueryData(oldKey), undefined);
    observed.unsubscribe();
});

test('account-wide queries and clear prefixes remain independent of school selection', async (t) => {
    const school = await schoolFixture(t);
    const { queryClient, query } = createHarness();
    t.after(() => queryClient.clear());
    const pending = deferred();
    const reading = query.ensure({ accountId: 'teacher-1', key: [], queryFn: () => pending.promise });
    school.select('school-b');
    pending.resolve({ account: 'teacher-1' });
    assert.deepEqual(await reading, { account: 'teacher-1' });
    assert.deepEqual(serverStateQueryKey('teacher-1'), ['server-state', 'teacher-1']);
    await query.clearAccount('teacher-1');
    assert.equal(queryClient.getQueryCache().getAll().length, 0);
});

test('late canceled query cannot cancel a newer in-flight request sharing its key', async () => {
    const { queryClient, query } = createHarness();
    const requests = [];
    const options = { accountId: 'teacher-1', key: ['teacher', 'shared'], queryFn: ({ signal }) => {
        const request = deferred(); requests.push({ ...request, signal }); return request.promise;
    } };
    const old = query.ensure(options);
    const oldOutcome = assert.rejects(old, error => error instanceof CancelledError);
    const newer = query.refresh(options);
    await waitFor(() => requests.length === 2);
    requests[0].resolve('old');
    await oldOutcome;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests[1].signal.aborted, false);
    requests[1].resolve('new');
    assert.equal(await newer, 'new');
    queryClient.clear();
});

test('explicit account scope shares keys, updates and invalidation across schools', async (t) => {
    const school = await schoolFixture(t);
    const { queryClient, query } = createHarness();
    t.after(() => queryClient.clear());
    const options = { accountId: 'teacher-1', key: ['wallet'], scope: 'account', staleTime: Infinity,
        queryFn: async () => ({ coins: 1 }) };
    const accountKey = query.key(options.accountId, options.key, options.scope);
    assert.deepEqual(await query.ensure(options), { coins: 1 });
    school.select('school-b');
    assert.deepEqual(query.key(options.accountId, options.key, options.scope), accountKey);
    query.setData({ ...options, updater: { coins: 2 } });
    assert.deepEqual(await query.ensure(options), { coins: 2 });
    await query.invalidate(options);
    assert.equal(queryClient.getQueryState(accountKey).isInvalidated, true);
    assert.deepEqual(await query.refresh(options), { coins: 1 });
    assert.equal(queryClient.getQueryCache().getAll().length, 1);
    await school.load('teacher-2');
    await query.clearAccount('teacher-1');
    assert.equal(queryClient.getQueryCache().getAll().length, 0);
});

test('student wallet observer and realtime updates survive school reloads but reject old accounts', async (t) => {
    const school = await schoolFixture(t);
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    globalThis.document = { getElementById: () => ({}), querySelector: () => null };
    globalThis.window = { addEventListener() {}, removeEventListener() {} };

    const { StudentProgressCloud } = await import('../js/student/studentProgressCloudMethods.js');
    const { studentProgressRepository } = await import('../js/services/studentProgressRepository.js');
    const { getActiveStudentStorageOwner, setActiveStudentStorageOwner } = await import('../js/student/persistence/studentStorage.js');
    const originalOwner = getActiveStudentStorageOwner();
    setActiveStudentStorageOwner('teacher-1');
    t.after(() => setActiveStudentStorageOwner(originalOwner));
    const { queryClient, query } = createHarness();
    let reads = 0, realtime;
    t.mock.method(studentProgressRepository, 'getSummary', async () => ({ coins: ++reads }));
    t.mock.method(studentProgressRepository, 'subscribe', (_owner, callback) => { realtime = callback; return () => {}; });
    const sm = { currentUser: { uid: 'teacher-1' }, setAuthStatus() {} };
    const cloud = new StudentProgressCloud({ sm, queryService: query });
    const applied = [];
    t.mock.method(cloud, 'flushLocalSyncQueue', async () => {});
    t.mock.method(cloud, 'applyRemoteCoinProgress', snapshot => applied.push(snapshot.coins));
    t.after(() => { cloud.stopCoinSync(); queryClient.clear(); globalThis.document = originalDocument; globalThis.window = originalWindow; });
    school.clear();
    cloud.startCoinSync();
    await cloud.coinSummaryObservation.refetch();
    assert.equal(reads, 1);
    await school.load('teacher-1');
    await cloud.coinSummaryObservation.refetch();
    assert.equal(reads, 2, 'Initial membership loading keeps the already active account wallet observer');
    await school.load('teacher-1');
    await cloud.coinSummaryObservation.refetch();
    assert.equal(reads, 3, 'Same-school membership reload does not strand the wallet observer');
    school.select('school-b');
    await cloud.coinSummaryObservation.refetch();
    assert.equal(reads, 4);
    realtime({ coins: 99 });
    assert.equal(applied.at(-1), 99, 'Realtime pushes use the same account cache after selecting another school');
    await cloud.refreshCoinsFromCloud();
    assert.equal(reads, 5);
    const pending = deferred();
    t.mock.method(studentProgressRepository, 'getSummary', () => { reads++; return pending.promise; });
    const staleRead = cloud.coinSummaryObservation.refetch();
    sm.currentUser = { uid: 'teacher-2' };
    setActiveStudentStorageOwner('teacher-2');
    await school.load('teacher-2');
    await query.clearAccount('teacher-1');
    const before = applied.length;
    realtime({ coins: 1000 });
    pending.resolve({ coins: 1000 });
    await staleRead;
    await cloud.coinSummaryObservation.refetch();
    assert.equal(reads, 6);
    assert.equal(applied.length, before, 'Old account observations and pushes cannot update the replacement account');
});


test('clearing an account or all queries blocks deferred account refresh dispatch even before membership loads', async (t) => {
    const school = await schoolFixture(t);
    school.clear();
    for (const clearAll of [false, true]) {
        for (const key of [[], ['wallet']]) {
            const { queryClient, query } = createHarness();
            let calls = 0;
            const options = { accountId: ' student-1 ', key, scope: 'account', queryFn: async () => { calls++; return 'replacement account data'; } };
            const refreshing = query.refresh(options);
            const outcome = assert.rejects(refreshing, error => error instanceof CancelledError);
            if (clearAll) query.clear();
            else await query.clearAccount('student-1');
            await outcome;
            assert.equal(calls, 0);
            assert.equal(queryClient.getQueryCache().getAll().length, 0);
            assert.equal(await query.ensure(options), 'replacement account data', 'A new account lifetime can read normally');
            query.clear();
        }
    }
});

test('an account observer cannot dispatch again after same-account cache lifetime replacement', async () => {
    const { queryClient, query } = createHarness();
    let calls = 0;
    const options = { accountId: 'student-1', key: ['wallet'], scope: 'account', queryFn: async () => ++calls };
    const observed = query.observe(options, () => {});
    await observed.refetch();
    assert.equal(calls, 1);
    await query.clearAccount('student-1');
    assert.equal(await query.ensure(options), 2);
    await observed.refetch();
    assert.equal(calls, 2, 'The previous account lifetime never invokes its request function');
    observed.unsubscribe();
    queryClient.clear();
});
