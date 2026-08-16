import { openDB } from 'idb';
import {
    MAX_SYNC_ATTEMPTS,
    MAX_SYNC_QUEUE_RECORDS,
    getSyncActionDedupeKey,
    getSyncRetryDelayMs
} from './services/syncQueuePolicy.js';

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
            this.dbPromise = openDB(this.dbName, 5, {
                upgrade: (db, _oldVersion, _newVersion, transaction) => {
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'id' });
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

    drawingId(vocabName, word) {
        return `${vocabName}_${word}`;
    }

    async saveDrawing(vocabName, word, blob) {
        const db = await this.open();
        await db.put(this.storeName, {
            id: this.drawingId(vocabName, word),
            vocabName,
            word,
            blob,
            date: new Date().toISOString()
        });
    }

    async getDrawing(vocabName, word) {
        const db = await this.open();
        const record = await db.get(this.storeName, this.drawingId(vocabName, word));
        return record?.blob ?? null;
    }

    async deleteDrawing(vocabName, word) {
        const db = await this.open();
        await db.delete(this.storeName, this.drawingId(vocabName, word));
    }

    async getAllKeys() {
        const db = await this.open();
        return db.getAllKeys(this.storeName);
    }

    async getAll() {
        const db = await this.open();
        return db.getAll(this.storeName);
    }

    async enqueueSyncAction(type, payload = {}) {
        const db = await this.open();
        const now = new Date().toISOString();
        const dedupeKey = getSyncActionDedupeKey(type, payload);
        if (dedupeKey) {
            const existing = await db.getFromIndex(this.syncStoreName, 'dedupeKey', dedupeKey);
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

        const allRecords = await db.getAll(this.syncStoreName);
        const terminalRecords = allRecords
            .filter(record => record.status === 'failed')
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
        const records = await db.getAllFromIndex(this.syncStoreName, 'status', 'pending');
        const now = Number(options.now) || Date.now();
        return records
            .filter(record => !record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= now)
            .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    }

    async completeSyncAction(id) {
        const db = await this.open();
        await db.delete(this.syncStoreName, id);
    }

    async markSyncActionFailed(record, error, options = {}) {
        const db = await this.open();
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

    async getFailedSyncActions() {
        const db = await this.open();
        const records = await db.getAllFromIndex(this.syncStoreName, 'status', 'failed');
        return records.sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
    }
}

export const imageDB = new ImageDB();
