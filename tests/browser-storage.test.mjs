import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { deleteDB } from 'idb';

import { ImageDB } from '../js/db.js';

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

    await db.completeSyncAction(first.id);
    assert.deepEqual((await db.getPendingSyncActions()).map(record => record.id), [second.id]);
    await db.deleteDrawing('unit-1', 'algorithm');
    assert.equal(await db.getDrawing('unit-1', 'algorithm'), null);

    await db.close();
    await deleteDB(db.dbName);
});
