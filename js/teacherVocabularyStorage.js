import { createElement, escapeHtml, notifications } from './main.js';
import {
    teacherApi as supabaseService,
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    setDoc
} from './services/teacherApi.js';
import {
    getVocabSubjectSlug,
    loadVocabularyFile
} from './services/vocabularyApi.js';

class TeacherVocabularyStorageMethods {
    async fetchCloudVocabs() {
        if (this.authDisabled) return [];
        if (!this.ensureAuthenticated(false)) return [];

        try {
            const db = supabaseService.getDatabase();
            const snapshot = await getDocs(collection(db, this.VOCAB_COLLECTION));
            this.setCloudStatus('Ready', 'info');
            return snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    source: 'cloud'
                };
            });
        } catch (error) {
            console.error('Failed to fetch cloud vocabularies:', error);
            this.setCloudStatus('Cloud load failed', 'error');
            return [];
        }
    }

    getLocalVocabs() {
        const stored = localStorage.getItem('teacher_vocab_library');
        return stored ? JSON.parse(stored).map(vocab => ({
            ...vocab,
            subjectSlug: getVocabSubjectSlug(vocab)
        })) : [];
    }

    removeLocalVocab(id) {
        if (!id) return false;
        const before = this.getLocalVocabs();
        const after = before.filter(vocab => vocab.id !== id);
        if (after.length === before.length) return false;

        localStorage.setItem('teacher_vocab_library', JSON.stringify(after));
        this.invalidateTeacherLibraryCache();
        return true;
    }

    saveToLocal(vocab) {
        if (!vocab.id) return; // Don't save without ID
        const { __source, ...rest } = vocab;
        const cleanVocab = {
            ...rest,
            subjectSlug: getVocabSubjectSlug(rest)
        };

        let vocabs = this.getLocalVocabs();
        const index = vocabs.findIndex(v => v.id === vocab.id);

        if (index >= 0) {
            vocabs[index] = cleanVocab;
        } else {
            vocabs.push(cleanVocab);
        }

        localStorage.setItem('teacher_vocab_library', JSON.stringify(vocabs));
        this.invalidateTeacherLibraryCache();
    }

    createLibraryCard(container, vocab, type) {
        const card = createElement('div', 'card teacher-vocab-card');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Open ${vocab.name || vocab.id || 'vocabulary'}`);

        const badgeStyles = {
            remote: { color: 'var(--primary-color)', text: 'Repo' },
            local: { color: 'var(--accent-color)', text: 'Draft' },
            cloud: { color: 'var(--primary-hover)', text: 'Cloud' }
        };

        const badge = badgeStyles[type] || badgeStyles.remote;
        const subject = this.getSubjectForVocab(vocab);

        let deleteBtnHtml = '';
        if (type === 'local' || type === 'cloud') {
            const label = type === 'cloud' ? 'Delete Cloud' : 'Delete Draft';
            deleteBtnHtml = `<button class="delete-vocab-btn" title="${label}" aria-label="${label}"><i data-lucide="trash-2"></i></button>`;
        }

        card.innerHTML = `
            <div class="badge" style="background:${badge.color};">${badge.text}</div>
            <div class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</div>
            <h3>${escapeHtml(vocab.name || 'Untitled')}</h3>
            <small style="color:var(--text-muted)">${escapeHtml(vocab.id)}</small>
            ${this.formatVocabPlacementLabel(vocab) ? `<small style="color:var(--text-muted); display:block; margin-top:0.35rem;">${escapeHtml(this.formatVocabPlacementLabel(vocab))}</small>` : ''}
            ${deleteBtnHtml}
        `;

        card.addEventListener('click', (e) => {
            // Prevent click if deleting
            if (e.target.closest('.delete-vocab-btn')) return;

            if (type === 'remote') {
                this.loadVocabularyFromPath(vocab.path);
            } else if (type === 'cloud') {
                this.loadVocabularyObject(vocab, { source: 'cloud' });
            } else {
                this.loadLocalVocabulary(vocab);
            }
        });
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            card.click();
        });

        if (type === 'local' || type === 'cloud') {
            const deleteBtn = card.querySelector('.delete-vocab-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const label = type === 'cloud' ? 'cloud' : 'draft';
                    if (confirm(`Delete ${label} vocabulary "${vocab.name}"? This cannot be undone.`)) {
                        if (type === 'local') {
                            this.deleteLocalVocab(vocab.id);
                        } else {
                            await this.deleteCloudVocab(vocab.id);
                        }
                        this.loadLibrary(); // Refresh
                    }
                });
            }
        }
        container.appendChild(card);
    }

    deleteLocalVocab(id) {
        this.removeLocalVocab(id);
    }

    async deleteCloudVocab(id) {
        if (!this.ensureAuthenticated()) return;
        try {
            const db = supabaseService.getDatabase();
            const ref = doc(db, this.VOCAB_COLLECTION, id);
            await deleteDoc(ref);
            this.invalidateTeacherLibraryCache();
        } catch (err) {
            console.error('Failed to delete cloud vocab', err);
            alert('Could not delete cloud vocabulary.');
        }
    }

    loadLocalVocabulary(vocab) {
        if (!this.ensureAuthenticated()) return;
        this.loadVocabularyObject(vocab, { source: 'local' });
    }

    async loadVocabularyFromPath(path) {
        if (!this.ensureAuthenticated()) return;
        const data = await loadVocabularyFile(path);
        if (data) {
            this.loadVocabularyObject(data, { source: 'remote', path });
        } else {
            alert('Failed to load vocabulary file.');
        }
    }

    async loadVocabularyById(vocabularyId) {
        if (!this.ensureAuthenticated(false)) return false;
        const id = String(vocabularyId || '').trim();
        if (!id) {
            this.showEditor();
            return false;
        }

        this.setCloudStatus('Loading vocabulary...', 'info');

        try {
            const library = await this.getTeacherLibrary();
            const item = library.items.find(({ vocab }) => vocab?.id === id);
            if (!item) {
                notifications.warning('That vocabulary could not be found. Returning to the library.');
                this.showVocabularyLibrary();
                return false;
            }

            if (item.type === 'remote') {
                const path = item.vocab.path;
                const data = await loadVocabularyFile(path);
                if (!data) throw new Error(`Could not load vocabulary file ${path}`);
                this.loadVocabularyObject(data, { source: 'remote', path });
            } else {
                this.loadVocabularyObject(item.vocab, { source: item.type });
            }
            return true;
        } catch (error) {
            console.error('Failed to restore vocabulary route:', error);
            notifications.error('Could not reopen that vocabulary after refresh.');
            this.showVocabularyLibrary();
            return false;
        }
    }

    loadVocabularyObject(vocab, options = {}) {
        const clone = JSON.parse(JSON.stringify(vocab));
        delete clone.__source;
        if (options.source) clone.source = options.source;
        if (options.path) clone.path = options.path;
        clone.subjectSlug = getVocabSubjectSlug(clone);
        this.vocabSet = clone;
        this.autoGenerateVocabId = false;
        this.updateFormUI();
        this.renderWords();
        this.showEditor();
    }

    // Helper to trigger auto-save
    triggerAutoSave() {
        if (!this.vocabSet.id) return;
        this.applyAssignedDatePlacement(this.vocabSet);
        this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
        this.normalizeActivityFlowSettings();

        if (this.authDisabled) {
            this.saveToLocal(this.vocabSet);
            this.setCloudStatus('Saved locally', 'success');
            return;
        }

        if (this.vocabSet.source === 'cloud') {
            this.queueCloudSave();
        } else {
            this.saveToLocal(this.vocabSet);
            this.queueCloudSave();
        }
    }

    queueCloudSave() {
        if (this.authDisabled) {
            this.setCloudStatus('Saved locally', 'success');
            return;
        }
        if (!this.isAuthenticated || !this.vocabSet.id) return;
        clearTimeout(this.cloudSaveTimeout);
        this.setCloudStatus('Saving...', 'info');
        this.cloudSaveTimeout = setTimeout(() => {
            this.saveToCloud();
        }, 800);
    }

    async saveToCloud() {
        if (this.authDisabled) return;
        if (!this.ensureAuthenticated(false)) return;
        if (!this.vocabSet.id) return;
        this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
        this.normalizeActivityFlowSettings();

        try {
            const db = supabaseService.getDatabase();
            const docRef = doc(db, this.VOCAB_COLLECTION, this.vocabSet.id);
            const { __source, source, ...rest } = this.vocabSet;
            const payload = {
                ...rest,
                ownerId: this.currentUser ? this.currentUser.uid : null,
                updatedAt: serverTimestamp()
            };
            await setDoc(docRef, payload);
            this.vocabSet.source = 'cloud';
            this.removeLocalVocab(this.vocabSet.id);
            this.invalidateTeacherLibraryCache();
            this.setCloudStatus('Saved to cloud', 'success');
            setTimeout(() => this.setCloudStatus('Ready', 'info'), 1500);
            return true;
        } catch (error) {
            console.error('Failed to save vocabulary to backend:', error);
            this.setCloudStatus('Save failed', 'error');
            notifications.error('Cloud save failed. Check backend rules to ensure authenticated users can write to the vocabularies collection.');
            return false;
        }
    }
}

export function installTeacherVocabularyStorageMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherVocabularyStorageMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherVocabularyStorageMethods.prototype, name)
        );
    }
}
