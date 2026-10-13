import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { deleteDB, openDB } from 'idb';

import { ImageDB } from '../js/db.js';
import {
    getStudentProgressStorageKey,
    setStudentActivityAssignment,
    readStudentActivityValue,
    writeStudentActivityValue,
    readStudentJson,
    setActiveStudentStorageOwner,
    writeStudentJson
} from '../js/student/persistence/studentStorage.js';
import {
    MAX_SYNC_ATTEMPTS,
    classifySyncError,
    getSyncRetryDelayMs
} from '../js/services/syncQueuePolicy.js';

test('browser storage commits drawings and ordered offline work reliably', async () => {
    const db = new ImageDB();
    await deleteDB(db.dbName);

    const drawing = new Blob(['drawing'], { type: 'text/plain' });
    await db.saveDrawing('unit-1', 'algorithm', drawing);
    assert.equal((await db.getDrawing('unit-1', 'algorithm')).size, drawing.size);
    assert.deepEqual(await db.getAllKeys(), ['unit-1_algorithm']);

    const first = await db.enqueueSyncAction('progress', { score: 80 });
    await new Promise(resolve => setTimeout(resolve, 2));
    const second = await db.enqueueSyncAction('progress', { score: 100 });
    assert.notEqual(first.id, second.id);
    assert.deepEqual((await db.getPendingSyncActions()).map(record => record.id), [first.id, second.id]);

    const failed = await db.markSyncActionFailed(first, new Error('offline'));
    assert.equal(failed.attempts, 1);
    assert.equal(failed.lastError, 'offline');
    assert.equal(failed.status, 'pending');
    assert.ok(Date.parse(failed.nextAttemptAt) > Date.now());
    assert.ok((await db.getPendingSyncActions({ includeDeferred: true })).some(record => record.id === first.id));

    await db.completeSyncAction(first.id);
    assert.deepEqual((await db.getPendingSyncActions()).map(record => record.id), [second.id]);
    await db.deleteDrawing('unit-1', 'algorithm');
    assert.equal(await db.getDrawing('unit-1', 'algorithm'), null);

    await db.close();
    await deleteDB(db.dbName);
});

test('offline work is deduplicated, delayed, and quarantined after bounded retries', async () => {
    const db = new ImageDB();
    await deleteDB(db.dbName);

    const first = await db.enqueueSyncAction('student-activity-progress', {
        eventId: 'event-1', score: 20
    });
    const replaced = await db.enqueueSyncAction('student-activity-progress', {
        eventId: 'event-1', score: 40
    });
    assert.equal(replaced.id, first.id);
    assert.equal(replaced.payload.score, 40);

    let record = replaced;
    for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt += 1) {
        record = await db.markSyncActionFailed(record, new Error('network'));
        assert.equal(record.attempts, attempt);
    }
    assert.equal(record.status, 'failed');
    assert.equal((await db.getFailedSyncActions())[0].id, first.id);
    assert.deepEqual(await db.getPendingSyncActions({ now: Date.now() + 1_000_000 }), []);

    await db.close();
    await deleteDB(db.dbName);
});

test('sync error classification distinguishes retryable transport failures from rejected data', () => {
    assert.equal(classifySyncError(new TypeError('Failed to fetch'), { online: true }).retryable, true);
    assert.equal(classifySyncError({ status: 503, message: 'Unavailable' }, { online: true }).retryable, true);
    assert.equal(classifySyncError({ status: 429, message: 'Slow down' }, { online: true }).retryable, true);
    assert.equal(classifySyncError({ status: 422, message: 'Invalid activity' }, { online: true }).retryable, false);
    assert.equal(classifySyncError({ code: 'P0001', message: 'Score outside the accepted range' }, { online: true }).retryable, false);
    assert.equal(classifySyncError(new Error('anything'), { online: false }).retryable, true);
    assert.equal(classifySyncError({ code: 'SYNC_OWNER_MISMATCH' }, { online: true }).retryable, false);
    assert.ok(getSyncRetryDelayMs(2) > getSyncRetryDelayMs(1));
});

test('explicit blank browser-storage owners are rejected instead of reassigned to the active student', async () => {
    const db = new ImageDB();
    await deleteDB(db.dbName);
    setActiveStudentStorageOwner('student-b');

    await assert.rejects(
        db.enqueueSyncAction('student-unit-work', { unitKey: 'unit-a' }, { ownerUserId: '' }),
        error => error.code === 'INVALID_STORAGE_OWNER'
    );
    await assert.rejects(
        db.saveDrawing('unit-a', 'word', new Blob(['a']), { ownerUserId: '   ' }),
        error => error.code === 'INVALID_STORAGE_OWNER'
    );
    assert.deepEqual(await db.getPendingSyncActions({ ownerUserId: 'student-b' }), []);

    await db.close();
    await deleteDB(db.dbName);
    setActiveStudentStorageOwner('local-dev');
});

test('student browser records stay isolated when accounts share one browser', async () => {
    const db = new ImageDB();
    await deleteDB(db.dbName);

    setActiveStudentStorageOwner('student-a');
    const drawingA = new Blob(['student-a'], { type: 'text/plain' });
    await db.saveDrawing('unit-1', 'algorithm', drawingA);
    const queuedA = await db.enqueueSyncAction('student-activity-progress', {
        eventId: 'shared-event',
        score: 80
    });

    setActiveStudentStorageOwner('student-b');
    assert.equal(await db.getDrawing('unit-1', 'algorithm'), null);
    assert.deepEqual(await db.getPendingSyncActions(), []);
    assert.equal(await db.completeSyncAction(queuedA.id), false);

    const queuedB = await db.enqueueSyncAction('student-activity-progress', {
        eventId: 'shared-event',
        score: 100
    });
    assert.notEqual(queuedA.id, queuedB.id);

    setActiveStudentStorageOwner('student-a');
    assert.equal(await (await db.getDrawing('unit-1', 'algorithm')).text(), 'student-a');
    assert.deepEqual((await db.getPendingSyncActions()).map(record => record.id), [queuedA.id]);

    await db.close();
    await deleteDB(db.dbName);
    setActiveStudentStorageOwner('local-dev');
});

test('student local storage uses owner keys and quarantines unowned legacy progress', () => {
    const values = new Map([['student_progress', JSON.stringify({ owner: 'unknown' })]]);
    const storage = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };

    writeStudentJson('progress', { owner: 'student-a' }, { owner: 'student-a', storage });
    writeStudentJson('progress', { owner: 'student-b' }, { owner: 'student-b', storage });

    assert.deepEqual(readStudentJson('progress', null, {
        owner: 'student-a',
        storage,
        legacyKeys: ['student_progress']
    }), { owner: 'student-a' });
    assert.deepEqual(readStudentJson('progress', null, { owner: 'student-b', storage }), { owner: 'student-b' });
    assert.equal(values.has('student_progress'), false);
    assert.equal(values.get('student:quarantine:v1:student_progress'), JSON.stringify({ owner: 'unknown' }));
    assert.notEqual(getStudentProgressStorageKey('student-a'), getStudentProgressStorageKey('student-b'));
});

test('database upgrade quarantines legacy sync work without an attributable owner', async () => {
    const db = new ImageDB();
    await deleteDB(db.dbName);
    const legacyDb = await openDB(db.dbName, 5, {
        upgrade(upgradeDb) {
            upgradeDb.createObjectStore('drawings', { keyPath: 'id' });
            const syncStore = upgradeDb.createObjectStore('syncQueue', { keyPath: 'id' });
            syncStore.createIndex('status', 'status');
            syncStore.createIndex('createdAt', 'createdAt');
            syncStore.createIndex('dedupeKey', 'dedupeKey');
        }
    });
    await legacyDb.put('syncQueue', {
        id: 'legacy-unowned',
        type: 'student-unit-work',
        payload: { score: 90 },
        status: 'pending',
        attempts: 0,
        createdAt: new Date().toISOString(),
        nextAttemptAt: new Date(0).toISOString()
    });
    legacyDb.close();

    const upgradedDb = await db.open();
    const legacyRecord = await upgradedDb.get('syncQueue', 'legacy-unowned');
    assert.equal(legacyRecord.status, 'quarantined');
    assert.equal(legacyRecord.ownerUserId, '');
    assert.equal(legacyRecord.failureReason, 'legacy-unowned');

    setActiveStudentStorageOwner('student-a');
    assert.deepEqual(await db.getPendingSyncActions(), []);
    await db.close();
    await deleteDB(db.dbName);
    setActiveStudentStorageOwner('local-dev');
});


test('assigned games cannot restore a same-name legacy game from another class', () => {
    const entries = new Map();
    const storage = { getItem: key => entries.get(key) ?? null,
        setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
    setActiveStudentStorageOwner('student-shared');
    writeStudentActivityValue('flashcards:Cells:10', 'old-class-state', { storage });
    assert.equal(readStudentActivityValue('flashcards:Cells:10', { storage }), 'old-class-state');
    for (const assignment of ['class-a-assignment', 'class-b-assignment']) {
        setStudentActivityAssignment(assignment);
        assert.equal(readStudentActivityValue('flashcards:Cells:10', { storage }), null);
        writeStudentActivityValue('flashcards:Cells:10', 'assignment-state', { storage });
        assert.equal(entries.size, 1, 'assigned games use normalized assignment state, never duplicate legacy caches');
    }
    setActiveStudentStorageOwner('different-student');
    assert.equal(readStudentActivityValue('flashcards:Cells:10', { storage }), null);
    setActiveStudentStorageOwner('local-dev');
});

test('parallel queue replacements serialize and stale acknowledgements preserve newer work', async () => {
    const db = new ImageDB();
    db.dbName = `queue-revisions-${Date.now()}`;
    const options = { ownerUserId: 'student-race' };
    try {
        const [first, second] = await Promise.all([
            db.enqueueSyncAction('student-spark-response', { sparkId: 'spark', answers: { q: 'first' } }, options),
            db.enqueueSyncAction('student-spark-response', { sparkId: 'spark', answers: { q: 'second' } }, options)
        ]);
        assert.equal(first.id, second.id);
        assert.equal(second.revision, first.revision + 1);
        assert.equal((await db.getPendingSyncActions(options)).length, 1);
        assert.equal(await db.completeSyncAction(first.id, { ...options, expectedRevision: first.revision }), false);
        assert.equal((await db.getPendingSyncActions(options))[0].payload.answers.q, 'second');
        const staleFailure = await db.markSyncActionFailed(first, new Error('network'), options);
        assert.equal(staleFailure.skipped, true);
        assert.equal((await db.getPendingSyncActions(options))[0].payload.answers.q, 'second');
        assert.equal(await db.completeSyncAction(second.id, { ...options, expectedRevision: second.revision }), true);
        assert.equal((await db.markSyncActionFailed(second, new Error('late network failure'), options)).skipped, true);
        assert.deepEqual(await db.getPendingSyncActions(options), []);
    } finally {
        await db.close();
        await deleteDB(db.dbName);
    }
});

test('legacy queue snapshots without revisions can still be acknowledged safely', async () => {
    const db = new ImageDB();
    db.dbName = `queue-legacy-revision-${Date.now()}`;
    const options = { ownerUserId: 'student-legacy' };
    try {
        const connection = await db.open();
        await connection.put(db.syncStoreName, { id: 'legacy', ownerUserId: options.ownerUserId,
            type: 'student-unit-work', status: 'pending', payload: {} });
        assert.equal(await db.completeSyncAction('legacy', { ...options, expectedRevision: 0 }), true);
    } finally {
        await db.close();
        await deleteDB(db.dbName);
    }
});

test('cumulative unit snapshots coalesce before event IDs without disturbing other owners or units', async () => {
    const db = new ImageDB();
    db.dbName = `unit-coalescing-${Date.now()}`;
    const options = { ownerUserId: 'student-a' };
    try {
        const otherOwner = await db.enqueueSyncAction('student-unit-work', { eventId: 'other-account', unitKey: 'unit' }, { ownerUserId: 'student-b' });
        const otherUnit = await db.enqueueSyncAction('student-unit-work', { eventId: 'other-unit', unitKey: 'other' }, options);
        const first = await db.enqueueSyncAction('student-unit-work', { eventId: 'event-0', unitKey: 'unit', workPatch: { states: { old: {} } } }, options);
        let latest;
        for (let i = 1; i <= 260; i++) {
            latest = await db.enqueueSyncAction('student-unit-work', { eventId: `event-${i}`, unitKey: 'unit',
                workPatch: { states: { matching: { version: i } }, wordHunt: { answer: `${i}` } } }, options);
        }
        const pending = await db.getPendingSyncActions(options);
        assert.equal(pending.length, 2);
        assert.equal(latest.id, first.id);
        assert.equal(latest.payload.eventId, 'event-260');
        assert.deepEqual(latest.payload.workPatch.states, { matching: { version: 260 } });
        assert.equal(await db.completeSyncAction(first.id, { ...options, expectedRevision: first.revision }), false);
        assert.ok(pending.some(record => record.id === otherUnit.id));
        assert.equal((await db.getPendingSyncActions({ ownerUserId: 'student-b' }))[0].id, otherOwner.id);
        for (let i = 0; i < 248; i++) await db.enqueueSyncAction('student-unit-work', { eventId: `distinct-${i}`, unitKey: `distinct-${i}` }, options);
        await assert.rejects(db.enqueueSyncAction('student-unit-work', { eventId: 'overflow', unitKey: 'overflow' }, options), error => error.code === 'SYNC_QUEUE_FULL');
        assert.equal((await db.getPendingSyncActions(options)).length, 250);
    } finally {
        await db.close();
        await deleteDB(db.dbName);
    }
});

test('unit coalescing compares capture order instead of failure arrival order', async () => {
    const db = new ImageDB();
    db.dbName = `unit-order-${Date.now()}`;
    const options = { ownerUserId: 'student-order' };
    try {
        const newer = await db.enqueueSyncAction('student-unit-work', { eventId: 'new-event', unitKey: 'unit',
            snapshotOrder: 200, workPatch: { states: { matching: { answer: 'new' } } } }, options);
        const old = await db.enqueueSyncAction('student-unit-work', { eventId: 'old-event', unitKey: 'unit',
            snapshotOrder: 100, workPatch: { states: { matching: { answer: 'old' } } } }, options);
        assert.equal(old.skipped, true);
        const retained = (await db.getPendingSyncActions(options))[0];
        assert.equal(retained.revision, newer.revision);
        assert.equal(retained.payload.eventId, 'new-event');
        assert.equal(retained.payload.workPatch.states.matching.answer, 'new');
    } finally {
        await db.close();
        await deleteDB(db.dbName);
    }
});

test('successful unit save retires only confirmed or older snapshots atomically', async () => {
    const db = new ImageDB();
    db.dbName = `unit-retirement-${Date.now()}`;
    const options = { ownerUserId: 'student-retirement' };
    try {
        const connection = await db.open();
        for (const [id, order, eventId, ownerUserId, unitKey] of [
            ['old', 100, 'old', options.ownerUserId, 'unit'],
            ['same-event', 200, 'confirmed', options.ownerUserId, 'unit'],
            ['peer', 200, 'equal-peer', options.ownerUserId, 'unit'],
            ['newer', 300, 'newer', options.ownerUserId, 'unit'],
            ['other-unit', 100, 'other', options.ownerUserId, 'other'],
            ['other-owner', 100, 'other-owner', 'student-other', 'unit']
        ]) await connection.put(db.syncStoreName, { id, ownerUserId, type: 'student-unit-work', status: 'pending',
            payload: { unitKey, snapshotOrder: order, eventId } });
        await db.retireUnitSyncActions({ unitKey: 'unit', snapshotOrder: 200, eventId: 'confirmed' }, options);
        assert.deepEqual((await connection.getAll(db.syncStoreName)).map(record => record.id).sort(),
            ['newer', 'other-owner', 'other-unit', 'peer']);
    } finally {
        await db.close();
        await deleteDB(db.dbName);
    }
});
