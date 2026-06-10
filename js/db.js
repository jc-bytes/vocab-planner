export class ImageDB {
    constructor() {
        this.dbName = 'VocabAppDB';
        this.storeName = 'drawings';
        this.syncStoreName = 'syncQueue';
        this.classroomDraftStoreName = 'classroomActivityDrafts';
        this.db = null;
    }

    async open() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 3);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(this.syncStoreName)) {
                    const syncStore = db.createObjectStore(this.syncStoreName, { keyPath: 'id' });
                    syncStore.createIndex('status', 'status', { unique: false });
                    syncStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
                if (!db.objectStoreNames.contains(this.classroomDraftStoreName)) {
                    const draftStore = db.createObjectStore(this.classroomDraftStoreName, { keyPath: 'id' });
                    draftStore.createIndex('studentId', 'studentId', { unique: false });
                    draftStore.createIndex('assignmentId', 'assignmentId', { unique: false });
                    draftStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async saveDrawing(vocabName, word, blob) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const id = `${vocabName}_${word}`;
            const record = {
                id: id,
                vocabName: vocabName,
                word: word,
                blob: blob,
                date: new Date().toISOString()
            };

            const request = store.put(record);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getDrawing(vocabName, word) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const id = `${vocabName}_${word}`;
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result ? request.result.blob : null);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteDrawing(vocabName, word) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const id = `${vocabName}_${word}`;
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllKeys() {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAllKeys();

            request.onsuccess = () => {
                resolve(request.result || []);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAll() {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async enqueueSyncAction(type, payload = {}) {
        await this.open();
        const now = new Date().toISOString();
        const record = {
            id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            type,
            payload,
            status: 'pending',
            attempts: 0,
            createdAt: now,
            updatedAt: now
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.syncStoreName], 'readwrite');
            const store = transaction.objectStore(this.syncStoreName);
            const request = store.put(record);

            request.onsuccess = () => resolve(record);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getPendingSyncActions() {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.syncStoreName], 'readonly');
            const store = transaction.objectStore(this.syncStoreName);
            const request = store.getAll();

            request.onsuccess = () => {
                const records = request.result || [];
                resolve(records
                    .filter(record => record.status === 'pending')
                    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))));
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async completeSyncAction(id) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.syncStoreName], 'readwrite');
            const store = transaction.objectStore(this.syncStoreName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async markSyncActionFailed(record, error) {
        await this.open();
        const updated = {
            ...record,
            attempts: (Number(record.attempts) || 0) + 1,
            lastError: error?.message || String(error || 'Sync failed'),
            updatedAt: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.syncStoreName], 'readwrite');
            const store = transaction.objectStore(this.syncStoreName);
            const request = store.put(updated);

            request.onsuccess = () => resolve(updated);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async saveClassroomDraft(draft) {
        if (!draft?.id) return null;
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.classroomDraftStoreName], 'readwrite');
            const store = transaction.objectStore(this.classroomDraftStoreName);
            const request = store.put(draft);

            request.onsuccess = () => resolve(draft);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getClassroomDraft(id) {
        if (!id) return null;
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.classroomDraftStoreName], 'readonly');
            const store = transaction.objectStore(this.classroomDraftStoreName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAllClassroomDrafts() {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.classroomDraftStoreName], 'readonly');
            const store = transaction.objectStore(this.classroomDraftStoreName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async deleteClassroomDraft(id) {
        if (!id) return;
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.classroomDraftStoreName], 'readwrite');
            const store = transaction.objectStore(this.classroomDraftStoreName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

export const imageDB = new ImageDB();
