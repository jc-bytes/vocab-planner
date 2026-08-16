import { openDB } from 'idb';

export class ImageDB {
    constructor() {
        this.dbName = 'VocabAppDB';
        this.storeName = 'drawings';
        this.syncStoreName = 'syncQueue';
        this.dbPromise = null;
    }

    async open() {
        if (!this.dbPromise) {
            this.dbPromise = openDB(this.dbName, 4, {
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
        const record = {
            id: `${type}-${crypto.randomUUID()}`,
            type,
            payload,
            status: 'pending',
            attempts: 0,
            createdAt: now,
            updatedAt: now
        };
        await db.put(this.syncStoreName, record);
        return record;
    }

    async getPendingSyncActions() {
        const db = await this.open();
        const records = await db.getAllFromIndex(this.syncStoreName, 'status', 'pending');
        return records.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    }

    async completeSyncAction(id) {
        const db = await this.open();
        await db.delete(this.syncStoreName, id);
    }

    async markSyncActionFailed(record, error) {
        const db = await this.open();
        const updated = {
            ...record,
            attempts: (Number(record.attempts) || 0) + 1,
            lastError: error?.message || String(error || 'Sync failed'),
            updatedAt: new Date().toISOString()
        };
        await db.put(this.syncStoreName, updated);
        return updated;
    }
}

export const imageDB = new ImageDB();
