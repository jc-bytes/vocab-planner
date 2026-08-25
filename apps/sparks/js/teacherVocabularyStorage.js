import { createElement, escapeHtml, notifications } from './main.js';
import { vocabularyRepository } from './services/vocabularyRepository.js';
import {
    getVocabSubjectSlug,
    loadVocabularyFile
} from './services/vocabularyApi.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';

const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');

class TeacherVocabularyStorageMethods {
    async fetchCloudVocabs(options = {}) {
        const isCurrent = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
        if (!isCurrent()) return [];
        if (this.authDisabled) return [];
        if (!this.ensureAuthenticated(false)) return [];

        try {
            const vocabularies = await vocabularyRepository.listMetadata();
            if (!isCurrent()) return [];
            this.setCloudStatus('Ready', 'info');
            return vocabularies.map(vocabulary => ({ ...vocabulary, source: 'cloud' }));
        } catch (error) {
            if (!isCurrent()) return [];
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
            remote: { className: 'teacher-vocab-source-badge--remote', text: 'Repo' },
            local: { className: 'teacher-vocab-source-badge--local', text: 'Draft' },
            cloud: { className: 'teacher-vocab-source-badge--cloud', text: 'Cloud' }
        };

        const badge = badgeStyles[type] || badgeStyles.remote;
        const subject = this.getSubjectForVocab(vocab);

        let deleteBtnHtml = '';
        if (type === 'local' || type === 'cloud') {
            const label = type === 'cloud' ? 'Delete Cloud' : 'Delete Draft';
            deleteBtnHtml = `<button class="delete-vocab-btn" title="${label}" aria-label="${label}"><i data-lucide="trash-2"></i></button>`;
        }

        card.innerHTML = `
            <div class="badge teacher-vocab-source-badge ${badge.className}">${badge.text}</div>
            <div class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</div>
            <h3 class="card-title">${escapeHtml(vocab.name || 'Untitled')}</h3>
            <small class="card-caption teacher-vocab-id">${escapeHtml(vocab.id)}</small>
            ${this.formatVocabPlacementLabel(vocab) ? `<small class="card-caption teacher-vocab-placement">${escapeHtml(this.formatVocabPlacementLabel(vocab))}</small>` : ''}
            ${deleteBtnHtml}
        `;

        card.addEventListener('click', (e) => {
            // Prevent click if deleting
            if (e.target.closest('.delete-vocab-btn')) return;
            this.openTeacherVocabularyItem(vocab, type);
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
                            this.loadLibrary();
                        } else {
                            const deleted = await this.deleteCloudVocab(vocab.id);
                            if (deleted) this.loadLibrary();
                        }
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
        const isCurrent = this.createTeacherVocabularyOperationGuard();
        try {
            await vocabularyRepository.remove(id);
            if (!isCurrent()) return false;
            this.invalidateTeacherLibraryCache();
            return true;
        } catch (err) {
            if (!isCurrent()) return false;
            console.error('Failed to delete cloud vocab', err);
            alert('Could not delete cloud vocabulary.');
            return false;
        }
    }

    loadLocalVocabulary(vocab) {
        if (!this.ensureAuthenticated()) return;
        this.loadVocabularyObject(vocab, { source: 'local' });
    }

    async loadVocabularyFromPath(path, options = {}) {
        const isCurrent = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
        if (!isCurrent() || !this.ensureAuthenticated()) return false;
        const data = await loadVocabularyFile(path);
        if (!isCurrent()) return false;
        if (data) {
            this.loadVocabularyObject(data, { source: 'remote', path });
            return true;
        } else {
            alert('Failed to load vocabulary file.');
            return false;
        }
    }

    async loadCloudVocabularyById(id, options = {}) {
        const isCurrent = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
        if (!isCurrent() || !this.ensureAuthenticated(false) || !id) return false;
        this.setCloudStatus('Loading vocabulary...', 'info');
        try {
            const vocabulary = await vocabularyRepository.get(id);
            if (!isCurrent()) return false;
            if (!vocabulary) throw new Error('Vocabulary not found.');
            this.loadVocabularyObject(vocabulary, { source: 'cloud' });
            this.setCloudStatus('Ready', 'info');
            return true;
        } catch (error) {
            if (!isCurrent()) return false;
            console.error(`Failed to load cloud vocabulary ${id}:`, error);
            this.setCloudStatus('Cloud load failed', 'error');
            notifications.error('Could not load that vocabulary. Please try again.');
            return false;
        }
    }

    async loadVocabularyById(vocabularyId, options = {}) {
        const isCurrent = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
        if (!isCurrent() || !this.ensureAuthenticated(false)) return false;
        const id = String(vocabularyId || '').trim();
        if (!id) {
            this.showEditor();
            return false;
        }

        this.setCloudStatus('Loading vocabulary...', 'info');

        try {
            const library = await this.getTeacherLibrary();
            if (!isCurrent()) return false;
            const item = library.items.find(({ vocab }) => vocab?.id === id);
            if (!item) {
                notifications.warning('That vocabulary could not be found. Returning to the library.');
                this.showTeacherSection(VOCABULARY_PAGE.id, { replaceRoute: true });
                return false;
            }

            if (item.type === 'remote') {
                const path = item.vocab.path;
                const data = await loadVocabularyFile(path);
                if (!isCurrent()) return false;
                if (!data) throw new Error(`Could not load vocabulary file ${path}`);
                this.loadVocabularyObject(data, { source: 'remote', path });
            } else if (item.type === 'cloud') {
                const loaded = await this.loadCloudVocabularyById(item.vocab.id, { isCurrent });
                if (!loaded && isCurrent()) {
                    this.showTeacherSection(VOCABULARY_PAGE.id, { replaceRoute: true });
                }
                return loaded;
            } else {
                this.loadVocabularyObject(item.vocab, { source: item.type });
            }
            return true;
        } catch (error) {
            if (!isCurrent()) return false;
            console.error('Failed to restore vocabulary route:', error);
            notifications.error('Could not reopen that vocabulary after refresh.');
            this.showTeacherSection(VOCABULARY_PAGE.id, { replaceRoute: true });
            return false;
        }
    }

    loadVocabularyObject(vocab, options = {}) {
        const clone = JSON.parse(JSON.stringify(vocab));
        delete clone.__source;
        if (options.source) clone.source = options.source;
        if (options.path) clone.path = options.path;
        clone.subjectSlug = getVocabSubjectSlug(clone);
        this.beginTeacherVocabularyDocument();
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
        const ticket = this.createTeacherVocabularySaveTicket(this.vocabSet);
        const documentGeneration = ticket.documentGeneration;
        const debounces = this.teacherVocabularySaveDebounces ||= new Map();
        clearTimeout(debounces.get(documentGeneration));
        clearTimeout(this.teacherVocabularyStatusTimer);
        this.teacherVocabularyStatusTimer = null;
        this.setCloudStatus('Saving...', 'info');
        const timeoutId = setTimeout(() => {
            if (debounces.get(documentGeneration) !== timeoutId) return;
            debounces.delete(documentGeneration);
            void this.enqueueTeacherVocabularySave(ticket);
        }, 800);
        debounces.set(documentGeneration, timeoutId);
    }

    createTeacherVocabularySaveTicket(vocab = this.vocabSet) {
        const snapshot = JSON.parse(JSON.stringify(vocab || {}));
        snapshot.subjectSlug = getVocabSubjectSlug(snapshot);
        this.normalizeActivityFlowSettings(snapshot);
        const documentGeneration = this.teacherVocabularyDocumentGeneration || 0;
        const sequence = (this.teacherVocabularySaveSequence || 0) + 1;
        this.teacherVocabularySaveSequence = sequence;
        this.teacherVocabularyLatestSaveByDocument ||= new Map();
        this.teacherVocabularyLatestSaveByDocument.set(documentGeneration, sequence);
        const sessionIsCurrent = this.createTeacherVocabularyOperationGuard();
        const navigation = this.captureTeacherNavigation?.() || null;
        return Object.freeze({ snapshot, documentGeneration, sequence, sessionIsCurrent, navigation });
    }

    isTeacherVocabularySaveLatest(ticket) {
        return ticket.sessionIsCurrent()
            && this.teacherVocabularyLatestSaveByDocument?.get(ticket.documentGeneration) === ticket.sequence;
    }

    isTeacherVocabularySaveUiCurrent(ticket) {
        return this.isTeacherVocabularySaveLatest(ticket)
            && ticket.documentGeneration === (this.teacherVocabularyDocumentGeneration || 0)
            && (!ticket.navigation || this.isTeacherNavigationCurrent?.(ticket.navigation));
    }

    enqueueTeacherVocabularySave(ticket) {
        const previous = this.teacherVocabularySaveQueue || Promise.resolve();
        const operation = previous.catch(() => {}).then(() => this.performTeacherVocabularySave(ticket));
        this.teacherVocabularySaveQueue = operation;
        return operation.finally(() => {
            if (this.teacherVocabularySaveQueue === operation) this.teacherVocabularySaveQueue = null;
        });
    }

    async performTeacherVocabularySave(ticket) {
        if (this.authDisabled || !ticket?.snapshot?.id || !ticket.sessionIsCurrent()) {
            return { status: 'stale', ticket };
        }
        if (!this.ensureAuthenticated(false)) return { status: 'stale', ticket };

        try {
            const { __source, source, ...rest } = ticket.snapshot;
            const payload = {
                ...rest,
                ownerId: this.currentUser?.uid || this.currentUser?.id || null,
                updatedAt: new Date().toISOString()
            };
            await vocabularyRepository.save(ticket.snapshot.id, payload);
            if (!ticket.sessionIsCurrent()) return { status: 'stale', ticket };
            if (this.isTeacherVocabularySaveLatest(ticket)) {
                this.removeLocalVocab(ticket.snapshot.id);
                this.invalidateTeacherLibraryCache();
            }
            if (this.isTeacherVocabularySaveUiCurrent(ticket)) {
                if (this.vocabSet?.id === ticket.snapshot.id) this.vocabSet.source = 'cloud';
                this.setCloudStatus('Saved to cloud', 'success');
                clearTimeout(this.teacherVocabularyStatusTimer);
                this.teacherVocabularyStatusTimer = setTimeout(() => {
                    if (!this.isTeacherVocabularySaveUiCurrent(ticket)) return;
                    this.teacherVocabularyStatusTimer = null;
                    this.setCloudStatus('Ready', 'info');
                }, 1500);
            }
            return { status: 'saved', ticket };
        } catch (error) {
            if (!ticket.sessionIsCurrent()) return { status: 'stale', ticket };
            console.error('Failed to save vocabulary to backend:', error);
            if (this.isTeacherVocabularySaveLatest(ticket)) {
                this.saveToLocal(ticket.snapshot);
            }
            if (this.isTeacherVocabularySaveUiCurrent(ticket)) {
                this.setCloudStatus('Save failed', 'error');
                notifications.error('Cloud save failed. Check backend rules to ensure authenticated users can write to the vocabularies collection.');
            }
            return { status: 'failed', ticket };
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
