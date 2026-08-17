import { openDB } from 'idb';
import {
    MAX_SYNC_ATTEMPTS,
    MAX_SYNC_QUEUE_RECORDS,
    getSyncActionDedupeKey,
    getSyncRetryDelayMs
} from './services/syncQueuePolicy.js';
import {
    getActiveStudentStorageOwner,
    normalizeStudentOwnerId
} from './student/persistence/studentStorage.js';

function createStorageId(type) {
    const id = globalThis.crypto?.randomUUID?.()
        || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${type}-${id}`;
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
            this.dbPromise = openDB(this.dbName, 6, {
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
            }).catch(error => {
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
        const db = await this.open();
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
        if (dedupeKey) {
            const existing = await db.getFromIndex(
                this.syncStoreName,
                'ownerDedupeKey',
                [ownerUserId, dedupeKey]
            );
            if (existing && existing.status !== 'failed') {
                const updated = {
                    ...existing,
                    payload,
                    status: 'pending',
                    nextAttemptAt: null,
                    updatedAt: now
                };
                await db.put(this.syncStoreName, updated);
                return updated;
            }
        }

        const allRecords = (await db.getAll(this.syncStoreName))
            .filter(record => record.ownerUserId === ownerUserId);
        const terminalRecords = allRecords
            .filter(record => record.status === 'failed' || record.status === 'quarantined')
            .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
        while (allRecords.length >= MAX_SYNC_QUEUE_RECORDS && terminalRecords.length > 0) {
            const discarded = terminalRecords.shift();
            await db.delete(this.syncStoreName, discarded.id);
            allRecords.splice(allRecords.findIndex(record => record.id === discarded.id), 1);
        }
        if (allRecords.length >= MAX_SYNC_QUEUE_RECORDS) {
            const error = new Error('Offline sync storage is full. Reconnect before saving more work.');
            error.code = 'SYNC_QUEUE_FULL';
            throw error;
        }

        const record = {
            id: createStorageId(type),
            ownerUserId,
            type,
            payload,
            dedupeKey,
            status: 'pending',
            attempts: 0,
            nextAttemptAt: null,
            createdAt: now,
            updatedAt: now
        };
        await db.put(this.syncStoreName, record);
        return record;
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
            .filter(record => !record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= now)
            .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    }

    async completeSyncAction(id, options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        const record = await db.get(this.syncStoreName, id);
        if (!record || record.ownerUserId !== ownerUserId) return false;
        await db.delete(this.syncStoreName, id);
        return true;
    }

    async markSyncActionFailed(record, error, options = {}) {
        const db = await this.open();
        const ownerUserId = this.resolveOwnerFromOptions(options);
        if (!record || record.ownerUserId !== ownerUserId) {
            throw new Error('Offline sync record ownership changed before it could be updated.');
        }
        const attempts = (Number(record.attempts) || 0) + 1;
        const terminal = options.terminal === true || attempts >= MAX_SYNC_ATTEMPTS;
        const now = Date.now();
        const updated = {
            ...record,
            status: terminal ? 'failed' : 'pending',
            attempts,
            lastError: error?.message || String(error || 'Sync failed'),
            failureReason: String(options.reason || ''),
            nextAttemptAt: terminal ? null : new Date(now + getSyncRetryDelayMs(attempts)).toISOString(),
            updatedAt: new Date(now).toISOString()
        };
        await db.put(this.syncStoreName, updated);
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
