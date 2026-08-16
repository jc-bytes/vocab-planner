import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';

import { ImageDB } from '../js/db.js';
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
    assert.ok(getSyncRetryDelayMs(2) > getSyncRetryDelayMs(1));
});
