import { schoolSessionKey } from './services/schoolScope.js';
import { notifications } from './main.js';
import { getTeacherVocabularySaves } from './teacherVocabularySaves.js';
import { vocabularyRepository } from './services/vocabularyRepository.js';
import {
    getVocabSubjectSlug,
    loadVocabularyFile
} from './services/vocabularyApi.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';
import { validateVocabularyCollection } from './services/vocabularyValidation.js';

const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');

class TeacherVocabularyStorageMethods {
    async fetchCloudVocabs(options = {}) {
        const isCurrent = typeof options.isCurrent === 'function' ? options.isCurrent : () => true;
        if (!isCurrent()) return [];
        if (this.authDisabled) return [];
        if (!this.ensureAuthenticated(false)) return [];

        try {
            const vocabularies = await vocabularyRepository.listMetadata({ signal: options.signal });
            if (!isCurrent()) return [];
            this.setCloudStatus('Ready', 'info');
            return vocabularies.map(vocabulary => ({ ...vocabulary, source: 'cloud' }));
        } catch (error) {
            if (!isCurrent()) return [];
            console.error('Failed to fetch cloud vocabularies:', error);
            this.setCloudStatus('Cloud load failed', 'error');
            throw error;
        }
    }

    getLocalVocabs() {
        const stored = localStorage.getItem(`teacher_vocab_library:${this.authDisabled ? 'demo' : schoolSessionKey(this.currentUser?.uid || this.currentUser?.id)}`);
        if (!stored) return [];
        try {
            const vocabularies = validateVocabularyCollection(JSON.parse(stored));
            if (!vocabularies) {
                console.warn('Local vocabulary drafts do not match the expected format.');
                return [];
            }
            return vocabularies.map(vocab => ({
                ...vocab,
                subjectSlug: getVocabSubjectSlug(vocab)
            }));
        } catch (error) {
            console.warn('Could not read local vocabulary drafts:', error);
            return [];
        }
    }

    removeLocalVocab(id) {
        if (!id) return false;
        const before = this.getLocalVocabs();
        const after = before.filter(vocab => vocab.id !== id);
        if (after.length === before.length) return false;

        localStorage.setItem(`teacher_vocab_library:${this.authDisabled ? 'demo' : schoolSessionKey(this.currentUser?.uid || this.currentUser?.id)}`, JSON.stringify(after));
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

        localStorage.setItem(`teacher_vocab_library:${this.authDisabled ? 'demo' : schoolSessionKey(this.currentUser?.uid || this.currentUser?.id)}`, JSON.stringify(vocabs));
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

        if (options.localCopy === true) {
            try {
                const localCopy = this.getLocalVocabs().find(vocab => vocab.id === id);
                if (!isCurrent()) return false;
                if (!localCopy) throw new Error('The requested local copy is unavailable.');
                this.loadVocabularyObject(localCopy, { source: 'local', localCopy: true });
                return true;
            } catch (error) {
                if (!isCurrent()) return false;
                console.warn('Could not open local vocabulary copy:', error);
                this.setCloudStatus('Local copy unavailable', 'error');
                notifications.warning('That local copy is unavailable on this device. Return to the library to choose a version.');
                this.showTeacherSection(VOCABULARY_PAGE.id, { replaceRoute: true });
                return false;
            }
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
        if (options.localCopy === true && clone.id) this.teacherVocabularyLocalCopyDocumentGeneration = this.teacherVocabularyDocumentGeneration;
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

        getTeacherVocabularySaves(this).schedule(this.vocabSet);
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
