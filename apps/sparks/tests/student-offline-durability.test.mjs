import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';

globalThis.document = { body: { appendChild() {} }, getElementById() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, append() {},
        appendChild() {}, addEventListener() {}, querySelector() { return null; }, remove() {} }) };
globalThis.window = { addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
const { imageDB } = await import('../js/db.js');
const { supabaseService } = await import('../js/supabaseService.js');
const { StudentProgressSyncQueue } = await import('../js/student/studentProgressSyncQueue.js');
const { MAX_SYNC_QUEUE_RECORDS, SYNC_RETRY_MAX_DELAY_MS, classifySyncError } = await import('../js/services/syncQueuePolicy.js');

async function fixture(t) {
    imageDB.dbName = `offline-durability-${crypto.randomUUID()}`;
    t.after(async () => { await imageDB.close(); await deleteDB(imageDB.dbName); });
    const ownerUserId = 'student-a', options = { ownerUserId };
    const applied = [], statuses = [];
    const sm = { authDisabled: false, currentUser: { uid: ownerUserId }, setAuthStatus: text => statuses.push(text),
        activities: { progressPersistence: { applyActivityProgressResult: progress => applied.push(progress) } } };
    const cloud = { sm, progress: {}, cloudGeneration: 1, isCurrentOwner: owner => owner === ownerUserId,
        applyUnitProgressResult: result => applied.push(result) };
    const queue = new StudentProgressSyncQueue(cloud);
    cloud.flushLocalSyncQueue = queue.flushLocalSyncQueue.bind(queue);
    queue.scheduler = { now: () => Date.now() + 1_000_000, setTimeout: () => null, clearTimeout() {} };
    return { ownerUserId, options, queue, applied, statuses };
}

test('seven transient failures retain the original durable receipt until a healthy replay', async t => {
    const { options, queue, applied } = await fixture(t);
    const payload = { eventId: 'original-receipt', unitKey: 'unit-a', activityType: 'matching', score: 100 };
    await imageDB.enqueueSyncAction('student-activity-progress', payload, options);
    let healthy = false;
    const requests = [];
    t.mock.method(supabaseService, 'submitStudentActivityProgress', async sent => {
        requests.push(structuredClone(sent));
        if (!healthy) throw Object.assign(new Error('Unavailable'), { status: 503 });
        return { activity: { isComplete: true } };
    });
    for (let attempt = 0; attempt < 7; attempt++) await queue.flushLocalSyncQueue({ ...options, silent: true });
    const pending = await imageDB.getPendingSyncActions({ ...options, includeDeferred: true });
    assert.equal(pending.length, 1);
    assert.equal(pending[0].attempts, 7);
    assert.equal((await imageDB.getFailedSyncActions(options)).length, 0);
    assert.ok(Date.parse(pending[0].nextAttemptAt) - Date.now() <= SYNC_RETRY_MAX_DELAY_MS);
    healthy = true;
    await queue.flushLocalSyncQueue({ ...options, silent: true });
    assert.equal(requests.length, 8);
    assert.ok(requests.every(sent => JSON.stringify(sent) === JSON.stringify(payload)));
    assert.equal(applied.length, 1);
    assert.equal((await imageDB.getPendingSyncActions({ ...options, includeDeferred: true })).length, 0);
});

test('queue capacity never deletes failed or quarantined unacknowledged work', async t => {
    const { options } = await fixture(t);
    const rejected = await imageDB.enqueueSyncAction('student-activity-progress', { eventId: 'rejected-original' }, options);
    await imageDB.markSyncActionFailed(rejected, Object.assign(new Error('Permission denied'), { status: 403 }),
        { ...options, terminal: true, reason: 'http-403' });
    const db = await imageDB.open();
    await db.put(imageDB.syncStoreName, { ...rejected, id: 'quarantined-original', status: 'quarantined' });
    for (let index = 2; index < MAX_SYNC_QUEUE_RECORDS; index++) {
        await imageDB.enqueueSyncAction('student-activity-progress', { eventId: `pending-${index}` }, options);
    }
    await assert.rejects(imageDB.enqueueSyncAction('student-activity-progress', { eventId: 'overflow' }, options),
        error => error.code === 'SYNC_QUEUE_FULL');
    const rows = await db.getAll(imageDB.syncStoreName);
    assert.equal(rows.length, MAX_SYNC_QUEUE_RECORDS);
    assert.ok(rows.some(row => row.id === rejected.id));
    assert.ok(rows.some(row => row.id === 'quarantined-original'));
    assert.ok(!rows.some(row => row.payload.eventId === 'overflow'));
});

test('legacy transient retirement recovers conservatively without reviving denials or other owners', async t => {
    const { options, queue } = await fixture(t);
    const db = await imageDB.open();
    const cases = [
        ['http-503', 'Unavailable', true], ['network', 'Failed to fetch', true], ['', 'Connection timed out', true],
        ['http-401', 'JWT expired', false], ['database-rejected', 'Invalid activity', false],
        ['unknown-transient', 'Something unexpected happened', false], ['offline', 'Permission denied', false],
        ['network_error', 'JWT expired', false], ['offline', 'Class is unavailable', false],
        ['', 'Invalid network request', false], ['offline', 'Assignment unavailable.', false],
        ['offline', 'Assignment is not accepting responses.', false], ['offline', 'Class unavailable.', false]
    ];
    for (const [index, [failureReason, lastError]] of cases.entries()) {
        await db.put(imageDB.syncStoreName, { id: `old-${index}`, ownerUserId: options.ownerUserId,
            type: 'student-activity-progress', status: 'failed', attempts: 5, revision: 7,
            payload: { eventId: `old-receipt-${index}` }, failureReason, lastError, createdAt: `${index}` });
    }
    await db.put(imageDB.syncStoreName, { id: 'other-owner', ownerUserId: 'student-b', status: 'failed',
        attempts: 5, revision: 1, failureReason: 'http-503', lastError: 'Unavailable', payload: { eventId: 'private' } });
    await db.put(imageDB.syncStoreName, { id: 'quarantine', ownerUserId: options.ownerUserId, status: 'quarantined',
        attempts: 5, revision: 1, failureReason: 'http-503', lastError: 'Unavailable', payload: { eventId: 'quarantined' } });
    await db.put(imageDB.syncStoreName, { id: 'unknown-attempts', ownerUserId: options.ownerUserId, status: 'failed',
        revision: 1, failureReason: 'http-503', lastError: 'Unavailable', payload: { eventId: 'unattributed-failure' } });
    const sent = [];
    t.mock.method(supabaseService, 'submitStudentActivityProgress', async payload => { sent.push(payload.eventId); return { totalXp: 0 }; });
    await queue.flushLocalSyncQueue({ ...options, silent: true });
    assert.deepEqual(sent, cases.flatMap((entry, index) => entry[2] ? [`old-receipt-${index}`] : []));
    assert.equal((await imageDB.getPendingSyncActions({ ...options, includeDeferred: true })).length, 0);
    assert.equal((await imageDB.getFailedSyncActions(options)).length, cases.filter(entry => !entry[2]).length + 1);
    assert.equal((await db.get(imageDB.syncStoreName, 'other-owner')).status, 'failed');
    assert.equal((await db.get(imageDB.syncStoreName, 'quarantine')).status, 'quarantined');
    assert.equal((await db.get(imageDB.syncStoreName, 'unknown-attempts')).status, 'failed');
});

for (const [type, method] of [['student-activity-progress', 'submitStudentActivityProgress'],
    ['student-unit-work', 'syncStudentUnitWork'], ['student-spark-response', 'submitStudentSparkResponse']]) {
    for (const missing of [null, undefined, {}]) {
        test(`${type} retains its receipt on an empty ${JSON.stringify(missing)} response before healthy recovery`, async t => {
            const { options, queue } = await fixture(t);
            const original = await imageDB.enqueueSyncAction(type,
                { eventId: 'unconfirmed', unitKey: 'unit', snapshotOrder: 1 }, options);
            const requests = [];
            t.mock.method(supabaseService, method, async payload => {
                requests.push(structuredClone(payload));
                return requests.length === 1 ? missing : { eventId: payload.eventId };
            });
            await queue.flushLocalSyncQueue({ ...options, silent: true });
            assert.equal((await (await imageDB.open()).get(imageDB.syncStoreName, original.id)).status, 'pending');
            await queue.flushLocalSyncQueue({ ...options, silent: true });
            assert.equal(requests.length, 2);
            assert.deepEqual(requests[0], requests[1]);
            assert.equal(await (await imageDB.open()).get(imageDB.syncStoreName, original.id), undefined);
        });
    }
}

test('definite server denial outranks a late offline signal while transient statuses and exact minimum time still retry', () => {
    for (const error of [{ status: 401 }, { status: 403, code: 'NETWORK_ERROR' }, { code: '42501' },
        { code: 'P0001', message: 'Invalid activity' }, { message: 'Assignment unavailable.' },
        { message: 'Assignment is not accepting responses.' }, { message: 'Class unavailable.' }]) {
        assert.equal(classifySyncError(error, { online: false }).retryable, false, JSON.stringify(error));
    }
    for (const status of [408, 425, 429, 500, 503]) {
        assert.equal(classifySyncError({ status }, { online: false }).retryable, true);
    }
    assert.deepEqual(classifySyncError({ code: 'P0001', message: 'The activity was completed too quickly to verify.' },
        { online: false }), { retryable: true, reason: 'minimum-activity-time', status: null });
});

test('legacy revival increments revisions so old acknowledgements and failures cannot overwrite recovered work', async t => {
    const { options } = await fixture(t);
    const db = await imageDB.open();
    const old = { id: 'legacy', ownerUserId: options.ownerUserId, type: 'student-activity-progress',
        status: 'failed', attempts: 5, revision: 2, failureReason: 'http-503', lastError: 'Unavailable',
        payload: { eventId: 'unchanged-event' } };
    await db.put(imageDB.syncStoreName, old);
    await imageDB.reviveRetryableSyncActions(options);
    assert.equal(await imageDB.completeSyncAction(old.id, { ...options, expectedRevision: 2 }), false);
    assert.equal((await imageDB.markSyncActionFailed(old, new Error('Late failure'), options)).skipped, true);
    const recovered = await db.get(imageDB.syncStoreName, old.id);
    assert.equal(recovered.revision, 3);
    assert.equal(recovered.status, 'pending');
    assert.deepEqual(recovered.payload, old.payload);
});

test('a full queue still compacts a superseded cumulative unit snapshot without dropping other receipts', async t => {
    const { options } = await fixture(t);
    await imageDB.enqueueSyncAction('student-unit-work', { eventId: 'old-unit', unitKey: 'unit', snapshotOrder: 1 }, options);
    for (let index = 1; index < MAX_SYNC_QUEUE_RECORDS; index++) {
        await imageDB.enqueueSyncAction('student-activity-progress', { eventId: `separate-${index}` }, options);
    }
    await imageDB.enqueueSyncAction('student-unit-work', { eventId: 'new-unit', unitKey: 'unit', snapshotOrder: 2 }, options);
    const rows = await (await imageDB.open()).getAll(imageDB.syncStoreName);
    assert.equal(rows.length, MAX_SYNC_QUEUE_RECORDS);
    assert.equal(rows.filter(row => row.type === 'student-activity-progress').length, MAX_SYNC_QUEUE_RECORDS - 1);
    assert.equal(rows.find(row => row.type === 'student-unit-work').payload.eventId, 'new-unit');
});

test('failed legacy recovery storage does not block healthy pending receipts from freeing capacity', async t => {
    const { options, queue } = await fixture(t);
    await imageDB.enqueueSyncAction('student-activity-progress', { eventId: 'ready' }, options);
    t.mock.method(imageDB, 'reviveRetryableSyncActions', async () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); });
    let requests = 0;
    t.mock.method(supabaseService, 'submitStudentActivityProgress', async () => { requests++; return { totalXp: 0 }; });
    await queue.flushLocalSyncQueue({ ...options, silent: true });
    assert.equal(requests, 1);
    assert.equal((await imageDB.getPendingSyncActions({ ...options, includeDeferred: true })).length, 0);
});

for (const committed of [false, true]) {
    test(`newer unpersisted unit intent ${committed ? 'with uncertain commit' : 'without commit'} cannot acknowledge or replay older work`, async t => {
        const { options, queue, statuses } = await fixture(t);
        const sm = queue.sm;
        sm.currentVocab = { id: 'unit', name: 'Unit' };
        sm.activities.getUnitProgressKey = () => 'unit';
        sm.progressData = { units: { unit: { notes: 'durable A' } } };
        const a = queue.buildUnitWorkSyncPayload();
        const original = await imageDB.enqueueSyncAction('student-unit-work', a, options);
        sm.progressData.units.unit.notes = 'newer B';
        const b = queue.buildUnitWorkSyncPayload();
        const requests = [];
        let serverNotes = 'initial', healthy = false;
        t.mock.method(supabaseService, 'syncStudentUnitWork', async payload => {
            requests.push(payload.eventId);
            if (committed || healthy) serverNotes = payload.workPatch.notes;
            if (!healthy) throw Object.assign(new Error('Response lost'), { code: 'NETWORK_ERROR' });
            return { version: 2 };
        });
        await assert.rejects(queue.executeUnitWork(b, options), /Response lost/);
        const unavailable = t.mock.method(imageDB, 'enqueueSyncAction', async () => { throw new Error('Quota exceeded'); });
        await assert.rejects(queue.enqueueProgressSync({ ...options, payload: b }), /Quota exceeded/);
        unavailable.mock.restore();
        healthy = true;
        await queue.flushLocalSyncQueue({ ...options, silent: true });
        const retained = await (await imageDB.open()).get(imageDB.syncStoreName, original.id);
        assert.ok(retained, 'a newer intent alone is not a durable replacement');
        assert.equal(retained.status, 'pending');
        assert.ok(Date.parse(retained.nextAttemptAt) > Date.now());
        assert.match(statuses.at(-1), /not synced.*Keep this page open/);
        assert.deepEqual(requests, [b.eventId], 'old A must not overwrite a possibly committed B');
        assert.equal(serverNotes, committed ? 'newer B' : 'initial');
        await queue.executeUnitWork(b, options);
        await queue.flushLocalSyncQueue({ ...options, silent: true });
        assert.equal(await (await imageDB.open()).get(imageDB.syncStoreName, original.id), undefined);
        assert.deepEqual(requests, [b.eventId, b.eventId]);
        assert.equal(serverNotes, 'newer B');
    });
}
