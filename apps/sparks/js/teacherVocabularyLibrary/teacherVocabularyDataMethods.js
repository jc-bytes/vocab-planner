import { $ } from '../main.js';
import { getVocabSubjectSlug, loadManifest } from '../services/vocabularyApi.js';
import { showLoadingState } from '../ui/loadingState.js';
import { filterTeacherVocabularyItems } from './teacherVocabularyModel.js';

export const teacherVocabularyDataMethods = {
async getTeacherLibrary({ forceRefresh = false } = {}) {
        if (!forceRefresh && this.teacherLibraryCache) {
            return this.teacherLibraryCache;
        }

        if (!forceRefresh && this.teacherLibraryPromise) {
            return this.teacherLibraryPromise;
        }

        this.teacherLibraryPromise = Promise.all([
            this.fetchCloudVocabs(),
            loadManifest()
        ]).then(([cloudVocabs, manifestData]) => {
            const remoteVocabs = Array.isArray(manifestData?.vocabularies)
                ? manifestData.vocabularies.map(vocab => ({ ...vocab, subjectSlug: getVocabSubjectSlug(vocab) }))
                : [];
            const cloudIds = new Set(cloudVocabs.map(vocab => vocab.id).filter(Boolean));
            const localVocabs = this.getLocalVocabs().filter(vocab => !cloudIds.has(vocab.id));
            const items = this.dedupeTeacherVocabularyItems([
                ...cloudVocabs.map(vocab => ({ vocab, type: 'cloud' })),
                ...remoteVocabs.map(vocab => ({ vocab, type: 'remote' })),
                ...localVocabs.map(vocab => ({ vocab, type: 'local' }))
            ]);

            this.teacherLibraryCache = {
                cloudVocabs,
                remoteVocabs,
                localVocabs,
                items,
                loadedAt: Date.now()
            };
            return this.teacherLibraryCache;
        }).finally(() => {
            this.teacherLibraryPromise = null;
        });

        return this.teacherLibraryPromise;
    },

getTeacherVocabularyItemPriority(type = '') {
        return { cloud: 3, local: 2, remote: 1 }[type] || 0;
    },

getTeacherVocabularyPurpose(vocab = {}, itemType = '') {
        const sourceLabels = new Set(['cloud', 'remote', 'local', 'repo', 'draft']);
        const candidates = [vocab?.purpose, vocab?.assessmentPurpose, vocab?.type, itemType];
        for (const candidate of candidates) {
            const value = String(candidate || '').trim();
            if (value && !sourceLabels.has(value.toLowerCase())) {
                return value;
            }
        }
        return '';
    },

getTeacherVocabularyDedupeKeys(vocab = {}) {
        const keys = [];
        const id = String(vocab?.id || '').trim().toLowerCase();
        if (id) keys.push(`id:${id}`);

        const name = String(vocab?.name || vocab?.title || '').trim().toLowerCase();
        if (!name) return keys;

        const subject = getVocabSubjectSlug(vocab);
        const grades = this.getVocabGrades(vocab).slice().sort((gradeA, gradeB) => this.compareGradeLabels(gradeA, gradeB)).join('|');
        const trimester = this.getTeacherTrimesterKey(vocab);
        const month = this.getTeacherMonthKey(vocab);
        const week = String(vocab?.week || this.inferTeacherWeek(vocab) || '').trim();
        keys.push(`placement:${subject}:${grades}:${trimester}:${month}:${week}:${name}`);
        return keys;
    },

mergeTeacherVocabularyMetadata(primary = {}, fallback = {}) {
        const primaryPurpose = this.getTeacherVocabularyPurpose(primary);
        const fallbackPurpose = this.getTeacherVocabularyPurpose(fallback);
        const merged = {
            ...fallback,
            ...primary
        };

        if (primaryPurpose) {
            merged.purpose = primaryPurpose;
        } else if (fallbackPurpose) {
            merged.purpose = fallbackPurpose;
            merged.assessmentPurpose = merged.assessmentPurpose || fallbackPurpose;
        }

        merged.subjectSlug = getVocabSubjectSlug(merged);
        return merged;
    },

mergeTeacherVocabularyItems(existingItem, incomingItem) {
        const existingPriority = this.getTeacherVocabularyItemPriority(existingItem?.type);
        const incomingPriority = this.getTeacherVocabularyItemPriority(incomingItem?.type);
        const primary = incomingPriority > existingPriority ? incomingItem : existingItem;
        const fallback = primary === incomingItem ? existingItem : incomingItem;

        return {
            type: primary.type,
            vocab: this.mergeTeacherVocabularyMetadata(primary.vocab, fallback.vocab)
        };
    },

dedupeTeacherVocabularyItems(items = []) {
        const deduped = [];
        const indexByKey = new Map();

        items.forEach(item => {
            const keys = this.getTeacherVocabularyDedupeKeys(item.vocab);
            const existingIndex = keys
                .map(key => indexByKey.get(key))
                .find(index => Number.isInteger(index));

            if (Number.isInteger(existingIndex)) {
                const merged = this.mergeTeacherVocabularyItems(deduped[existingIndex], item);
                deduped[existingIndex] = merged;
                this.getTeacherVocabularyDedupeKeys(merged.vocab).forEach(key => indexByKey.set(key, existingIndex));
                return;
            }

            const nextIndex = deduped.length;
            deduped.push(item);
            keys.forEach(key => indexByKey.set(key, nextIndex));
        });

        return deduped;
    },

async loadLibrary() {
        const list = $('#library-list');
        if (!list) return;

        if (!this.authDisabled && !this.isAuthenticated) {
            list.innerHTML = '<p>Please sign in to view the library.</p>';
            return;
        }

        showLoadingState(list, 'Loading library...');

        try {
            const { cloudVocabs, remoteVocabs, localVocabs, items } = await this.getTeacherLibrary();

            list.innerHTML = '';

            if (cloudVocabs.length === 0 && remoteVocabs.length === 0 && localVocabs.length === 0) {
                list.innerHTML = '<p>No vocabularies found.</p>';
                return;
            }

            this.libraryItems = items;
            this.renderLibraryBrowser(list);
            this.refreshIcons();
        } catch (error) {
            console.error('Failed to load vocabularies:', error);
            list.innerHTML = '<p>Failed to load vocabulary list.</p>';
        }
    },

resetLibraryDrilldown() {
        this.libraryDrilldown = {
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
    },

buildLibraryGroups(items = this.libraryItems) {
        const subjectGroups = new Map();

        items.forEach(({ vocab, type }) => {
            const subjectSlug = getVocabSubjectSlug(vocab);
            const grades = this.getVocabGrades(vocab);
            const trimesterKey = this.getTeacherTrimesterKey(vocab);

            if (!subjectGroups.has(subjectSlug)) {
                subjectGroups.set(subjectSlug, new Map());
            }
            const gradeGroups = subjectGroups.get(subjectSlug);

            grades.forEach(grade => {
                if (!gradeGroups.has(grade)) {
                    gradeGroups.set(grade, new Map());
                }

                const trimesterGroups = gradeGroups.get(grade);
                if (!trimesterGroups.has(trimesterKey)) {
                    trimesterGroups.set(trimesterKey, []);
                }

                trimesterGroups.get(trimesterKey).push({ vocab, type });
            });
        });

        return subjectGroups;
    },

getTeacherVocabularyItemsForDrilldown(drilldown = {}) {
        return filterTeacherVocabularyItems(this.libraryItems, drilldown, {
            getGrades: vocab => this.getVocabGrades(vocab),
            getTrimesterKey: vocab => this.getTeacherTrimesterKey(vocab),
            getMonthKey: vocab => this.getTeacherMonthKey(vocab)
        });
    },

openTeacherVocabularyItem(vocab, type) {
        if (type === 'remote') {
            this.loadVocabularyFromPath(vocab.path);
        } else if (type === 'cloud') {
            this.loadCloudVocabularyById(vocab.id);
        } else {
            this.loadLocalVocabulary(vocab);
        }
    }
};
