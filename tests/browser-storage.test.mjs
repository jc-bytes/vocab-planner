import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { deleteDB, openDB } from 'idb';

import { ImageDB } from '../js/db.js';
import {
    getStudentProgressStorageKey,
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
