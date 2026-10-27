import { createUniqueId } from './randomUtils.js';
import {
    MAX_SYNC_QUEUE_RECORDS,
    getSyncActionDedupeKey,
    getSyncRetryDelayMs,
    isRecoverableLegacySyncFailure
} from './services/syncQueuePolicy.js';
import {
    getActiveStudentStorageOwner,
    normalizeStudentOwnerId
} from './student/persistence/studentStorage.js';

function createStorageId(type) {
    return createUniqueId(`${type}-`);
}

function compareSyncOrder(a, b) {
    const left = Number(a.queueOrder) || 0, right = Number(b.queueOrder) || 0;
    // Legacy timestamp ties have no recoverable chronology; keep a stable fallback.
    return left - right || String(a.createdAt).localeCompare(String(b.createdAt))
        || String(a.id).localeCompare(String(b.id));
}

export class ImageDB {
    constructor() {
        this.dbName = 'VocabAppDB';
        this.storeName = 'drawings';
        this.syncStoreName = 'syncQueue';
        this.dbPromise = null;
    }

    async open() {
        if (!this.dbPromise) {
            this.dbPromise = import('idb').then(({ openDB }) => openDB(this.dbName, 6, {
                upgrade: (db, _oldVersion, _newVersion, transaction) => {
                    const drawingStore = db.objectStoreNames.contains(this.storeName)
                        ? transaction.objectStore(this.storeName)
                        : db.createObjectStore(this.storeName, { keyPath: 'id' });
                    if (!drawingStore.indexNames.contains('ownerUserId')) {
                        drawingStore.createIndex('ownerUserId', 'ownerUserId', { unique: false });
                    }
                    const syncStore = db.objectStoreNames.contains(this.syncStoreName)
                        ? transaction.objectStore(this.syncStoreName)
                        : db.createObjectStore(this.syncStoreName, { keyPath: 'id' });
                    if (!syncStore.indexNames.contains('status')) {
                        syncStore.createIndex('status', 'status', { unique: false });
                    }
                    if (!syncStore.indexNames.contains('createdAt')) {
                        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
                    }
                    if (!syncStore.indexNames.contains('dedupeKey')) {
                        syncStore.createIndex('dedupeKey', 'dedupeKey', { unique: false });
                    }
                    if (!syncStore.indexNames.contains('ownerStatus')) {
                        syncStore.createIndex('ownerStatus', ['ownerUserId', 'status'], { unique: false });
                    }
                    if (!syncStore.indexNames.contains('ownerDedupeKey')) {
                        syncStore.createIndex('ownerDedupeKey', ['ownerUserId', 'dedupeKey'], { unique: false });
                    }

                    if (_oldVersion < 6) {
                        syncStore.openCursor().then(function quarantineLegacyRecord(cursor) {
                            if (!cursor) return;
                            const record = cursor.value;
                            if (!normalizeStudentOwnerId(record.ownerUserId)) {
                                cursor.update({
                                    ...record,
                                    ownerUserId: '',
                                    status: 'quarantined',
                                    failureReason: 'legacy-unowned',
                                    updatedAt: new Date().toISOString()
                                });
                            }
                            return cursor.continue().then(quarantineLegacyRecord);
                        });
                    }
                },
                blocked: () => {
                    console.warn('Browser storage upgrade is waiting for another app tab to close.');
                },
                blocking: (currentVersion, blockedVersion) => {
                    console.warn(`Closing browser storage version ${currentVersion} for version ${blockedVersion}.`);
                    this.close();
                },
                terminated: () => {
                    console.warn('Browser storage connection ended unexpectedly; it will reopen when needed.');
                    this.dbPromise = null;
                }
            })).catch(error => {
                this.dbPromise = null;
                throw error;
            });
        }
        return this.dbPromise;
    }

    async close() {
        const dbPromise = this.dbPromise;
        this.dbPromise = null;
        if (!dbPromise) return;
        try {
            const db = await dbPromise;
            db.close();
        } catch (_error) {
            // A failed open has already reset dbPromise and requires no cleanup.
        }
    }

    resolveOwnerUserId(value, options = {}) {
        const ownerUserId = normalizeStudentOwnerId(value);
        if (ownerUserId) return ownerUserId;
        if (options.explicit === true) {
            const error = new Error('Browser storage requires a valid student owner.');
            error.code = 'INVALID_STORAGE_OWNER';
            throw error;
        }
        return getActiveStudentStorageOwner();
    }

    resolveOwnerFromOptions(options = {}) {
        return this.resolveOwnerUserId(options.ownerUserId, {
            explicit: Object.prototype.hasOwnProperty.call(options, 'ownerUserId')
        });
    }

    drawingKey(vocabName, word) {
        return `${vocabName}_${word}`;
    }

    drawingId(vocabName, word, ownerUserId = getActiveStudentStorageOwner()) {
        return `${this.resolveOwnerUserId(ownerUserId)}::${this.drawingKey(vocabName, word)}`;
    }

    async saveDrawing(vocabName, word, blob, options = {}) {
        options.signal?.throwIfAborted();
        const db = await this.open();
        options.signal?.throwIfAborted();
        if (options.isCurrent && !options.isCurrent()) throw new DOMException('Drawing owner changed.', 'AbortError');
        const ownerUserId = this.resolveOwnerFromOptions(options);
        await db.put(this.storeName, {
            id: this.drawingId(vocabName, word, ownerUserId),
            drawingKey: this.drawingKey(vocabName, word),
            ownerUserId,
            vocabName,
            word,
            blob,
            date: new Date().toISOString()
        });
    }

    async getDrawing(vocabName, word, options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        const record = await db.get(this.storeName, this.drawingId(vocabName, word, ownerUserId));
        return record?.blob ?? null;
    }

    async deleteDrawing(vocabName, word, options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        await db.delete(this.storeName, this.drawingId(vocabName, word, ownerUserId));
    }

    async getAllKeys(options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        const records = await db.getAllFromIndex(this.storeName, 'ownerUserId', ownerUserId);
        return records.map(record => record.drawingKey || this.drawingKey(record.vocabName, record.word));
    }

    async getAll(options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        return db.getAllFromIndex(this.storeName, 'ownerUserId', ownerUserId);
    }

    async enqueueSyncAction(type, payload = {}, options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        const now = new Date().toISOString();
        const dedupeKey = getSyncActionDedupeKey(type, payload);
        const tx = db.transaction(this.syncStoreName, 'readwrite');
        const store = tx.objectStore(this.syncStoreName);
        // A single readwrite transaction allocates order across tabs/connections.
        // Once no receipts remain the counter may restart; no causal work remains.
        const ownerRecords = (await store.getAll()).filter(record => record.ownerUserId === ownerUserId);
        const nextOrder = () => Math.max(0, ...ownerRecords.map(record => Number(record.queueOrder) || 0)) + 1;
        if (dedupeKey) {
            let existing = await store.index('ownerDedupeKey').get([ownerUserId, dedupeKey]);
            if (type === 'student-unit-work') {
                // Also compact snapshots saved by versions that keyed unit work by event ID.
                const unitRecords = (await store.getAll()).filter(record => record.ownerUserId === ownerUserId
                    && record.type === type && record.payload?.unitKey === payload.unitKey);
                existing = unitRecords.reduce((latest, record) => !latest
                    || (Number(record.payload?.snapshotOrder) || 0) > (Number(latest.payload?.snapshotOrder) || 0)
                    ? record : latest, existing);
                if (existing && (Number(existing.payload?.snapshotOrder) || 0) > (Number(payload.snapshotOrder) || 0)) {
                    await tx.done;
                    return { ...existing, skipped: true };
                }
                for (const record of unitRecords) {
                    if (record.id !== existing.id) await store.delete(record.id);
                }
            }
            if (existing && (existing.status !== 'failed' || type === 'student-unit-work')) {
                const updated = {
                    ...existing,
                    payload,
                    dedupeKey,
                    queueOrder: payload.eventId !== existing.payload?.eventId ? nextOrder() : existing.queueOrder,
                    ...(type === 'student-unit-work' && payload.eventId !== existing.payload?.eventId
                        ? { attempts: 0, lastError: '', failureReason: '' } : {}),
                    revision: (Number(existing.revision) || 0) + 1,
                    status: 'pending',
                    nextAttemptAt: null,
                    updatedAt: now
                };
                await store.put(updated);
                await tx.done;
                return updated;
            }
        }

        if (ownerRecords.length >= MAX_SYNC_QUEUE_RECORDS) {
            const error = new Error('Offline sync storage is full. Reconnect before saving more work.');
            error.code = 'SYNC_QUEUE_FULL';
            await tx.done;
            throw error;
        }

        const record = {
            id: createStorageId(type),
            queueOrder: nextOrder(),
            ownerUserId,
            type,
            payload,
            dedupeKey,
            status: 'pending',
            attempts: 0,
            revision: 1,
            nextAttemptAt: null,
            createdAt: now,
            updatedAt: now
        };
        await store.put(record);
        await tx.done;
        return record;
    }

    async retireUnitSyncActions(payload, options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        const tx = db.transaction(this.syncStoreName, 'readwrite');
        const store = tx.objectStore(this.syncStoreName);
        const confirmedOrder = Number(payload.snapshotOrder) || 0;
        for (const record of await store.getAll()) {
            if (record.ownerUserId !== ownerUserId || record.type !== 'student-unit-work'
                || record.payload?.unitKey !== payload.unitKey) continue;
            if ((Number(record.payload.snapshotOrder) || 0) < confirmedOrder
                || record.payload.eventId === payload.eventId) {
                await store.delete(record.id);
            }
        }
        await tx.done;
    }

    async getPendingSyncActions(options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        const records = await db.getAllFromIndex(
            this.syncStoreName,
            'ownerStatus',
            [ownerUserId, 'pending']
        );
        const now = Number(options.now) || Date.now();
        return records
            .filter(record => options.includeDeferred || !record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= now)
            .sort(compareSyncOrder);
    }

    async getNewerUnitSyncAction(record, options = {}) {
        const pending = await this.getPendingSyncActions({ ...options, includeDeferred: true });
        return pending.filter(candidate => candidate.type === 'student-unit-work'
            && candidate.payload?.unitKey === record.payload?.unitKey
            && compareSyncOrder(candidate, record) > 0).at(-1) || null;
    }

    async reviveRetryableSyncActions(options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        const tx = db.transaction(this.syncStoreName, 'readwrite');
        const store = tx.objectStore(this.syncStoreName);
        for (const record of await store.index('ownerStatus').getAll([ownerUserId, 'failed'])) {
            if (!isRecoverableLegacySyncFailure(record)) continue;
            await store.put({ ...record, status: 'pending', nextAttemptAt: null,
                revision: (Number(record.revision) || 0) + 1, updatedAt: new Date().toISOString() });
        }
        await tx.done;
    }

    async completeSyncAction(id, options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        const tx = db.transaction(this.syncStoreName, 'readwrite');
        const store = tx.objectStore(this.syncStoreName);
        const record = await store.get(id);
        const matches = record && record.ownerUserId === ownerUserId
            && (options.expectedRevision === undefined
                || (Number(record.revision) || 0) === (Number(options.expectedRevision) || 0));
        if (matches) await store.delete(id);
        await tx.done;
        return Boolean(matches);
    }

    async markSyncActionFailed(record, error, options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        if (!record || record.ownerUserId !== ownerUserId) {
            throw new Error('Offline sync record ownership changed before it could be updated.');
        }
        const tx = db.transaction(this.syncStoreName, 'readwrite');
        const store = tx.objectStore(this.syncStoreName);
        const current = await store.get(record.id);
        // Another tab may have replaced or acknowledged this snapshot during the request.
        if (!current || current.ownerUserId !== ownerUserId
            || (Number(current.revision) || 0) !== (Number(record.revision) || 0)) {
            await tx.done;
            return { ...(current || record), skipped: true };
        }
        const attempts = Math.min(Number.MAX_SAFE_INTEGER, (Number(current.attempts) || 0) + 1);
        const terminal = options.terminal === true;
        const now = Date.now();
        const updated = {
            ...current,
            revision: (Number(current.revision) || 0) + 1,
            status: terminal ? 'failed' : 'pending',
            attempts,
            lastError: error?.message || String(error || 'Sync failed'),
            failureReason: String(options.reason || ''),
            nextAttemptAt: terminal ? null : new Date(now + getSyncRetryDelayMs(attempts)).toISOString(),
            updatedAt: new Date(now).toISOString()
        };
        await store.put(updated);
        await tx.done;
        return updated;
    }

    async getFailedSyncActions(options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        const records = await db.getAllFromIndex(
            this.syncStoreName,
            'ownerStatus',
            [ownerUserId, 'failed']
        );
        return records.sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
    }
}

export const imageDB = new ImageDB();
