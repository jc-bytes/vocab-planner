import { getVocabSubjectSlug } from '../services/vocabularyApi.js';
import { serverStateQuery } from '../services/serverStateQuery.js';
import { teacherPageRegistry } from '../teacherPageRegistry.js';
const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');
export const TEACHER_VOCABULARY_CLOUD_QUERY_KEY = ['teacher', 'vocabulary-library-cloud'];
function staleTeacherLibraryResult() { return { cloudVocabs: [], remoteVocabs: [], localVocabs: [], localCopyIds: [], items: [], stale: true }; }
export const teacherVocabularyDataMethods = {
async getTeacherLibrary({ forceRefresh = false } = {}) {
        const isCurrent = this.createTeacherVocabularyOperationGuard();
        const accountId = this.currentUser?.uid || this.currentUser?.id;
        if (!accountId || !isCurrent()) return staleTeacherLibraryResult();

        let loadGeneration = this.teacherVocabularyLibraryLoadGeneration || 0;
        if (forceRefresh) {
            loadGeneration += 1;
            this.teacherVocabularyLibraryLoadGeneration = loadGeneration;
        }
        const isLatest = () => loadGeneration === (this.teacherVocabularyLibraryLoadGeneration || 0);
        const queryService = this.teacherVocabularyQueryService || serverStateQuery;
        const cloudQuery = {
            accountId,
            key: TEACHER_VOCABULARY_CLOUD_QUERY_KEY,
            queryFn: ({ signal }) => this.fetchCloudVocabs({ isCurrent, signal })
        };

        let cloudVocabs;
        try {
            cloudVocabs = await (forceRefresh ? queryService.refresh(cloudQuery) : queryService.ensure(cloudQuery));
        } catch (error) {
            if (!isCurrent() || !isLatest()) return staleTeacherLibraryResult();
            throw error;
        }

        if (!isCurrent() || !isLatest()) return staleTeacherLibraryResult();

        cloudVocabs = cloudVocabs.map(vocab => ({ ...vocab }));
        // Published school materials are private; do not fetch the retired public catalogue.
        const remoteVocabs = [];
        const cloudIds = new Set(cloudVocabs.map(vocab => vocab.id).filter(Boolean));
        const allLocalVocabs = this.getLocalVocabs();
        const localCopyIds = [...new Set(allLocalVocabs.filter(vocab => cloudIds.has(vocab.id)).map(vocab => vocab.id))];
        const localVocabs = allLocalVocabs.filter(vocab => !cloudIds.has(vocab.id));
        const items = this.dedupeTeacherVocabularyItems([
            ...cloudVocabs.map(vocab => ({ vocab, type: 'cloud' })),
            ...remoteVocabs.map(vocab => ({ vocab, type: 'remote' })),
            ...localVocabs.map(vocab => ({ vocab, type: 'local' }))
        ]);

        return {
            cloudVocabs,
            remoteVocabs,
            localVocabs,
            localCopyIds,
            items,
            loadedAt: Date.now()
        };
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
async openTeacherVocabularyItem(vocab, type) {
        if (!this.ensureAuthenticated(false)) return;
        const returnRoute = this.parseRoute?.() || { view: VOCABULARY_PAGE.id };
        const navigation = this.beginTeacherNavigation();
        const isCurrent = () => this.isTeacherNavigationCurrent(navigation);
        this.setRoute({ view: 'editor', vocabularyId: vocab?.id || null, ...(type === 'local-copy' ? { localCopy: true } : {}) });
        let loaded = true;
        if (type === 'local-copy') {
            loaded = await this.loadVocabularyById(vocab?.id, { isCurrent, localCopy: true });
        } else if (type === 'remote') {
            loaded = await this.loadVocabularyFromPath(vocab.path, { isCurrent });
        } else if (type === 'cloud') {
            loaded = await this.loadCloudVocabularyById(vocab.id, { isCurrent });
        } else {
            if (isCurrent()) this.loadLocalVocabulary(vocab);
        }
        if (!loaded && isCurrent()) {
            this.setRoute(returnRoute, { replace: true });
        }
    },
describeTeacherVocabularyGrouping(vocab = {}) {
        return { grades: this.getVocabGrades(vocab), trimesterKey: this.getTeacherTrimesterKey(vocab) };
    },
 describeTeacherVocabulary(vocab = {}, type = '') {
 const trimester = this.getTeacherTrimesterKey(vocab), month = this.getTeacherMonthKey(vocab);
 return { grades: this.getVocabGrades(vocab).map(value => ({ value, label: this.formatGradeLabel(value), order: this.getGradeSortValue(value) })),
 trimester: { key: trimester, label: this.getTeacherTrimesterLabel(trimester), shortLabel: this.getTeacherTrimesterShortLabel(trimester), order: this.getTeacherTrimesterOrder(trimester) },
 month: { key: month, label: this.getTeacherMonthLabel(month), shortLabel: this.getTeacherMonthShortLabel(month), order: this.getTeacherMonthOrder(month) },
 week: vocab.week || this.inferTeacherWeek(vocab) || '', purpose: this.getTeacherVocabularyPurpose(vocab, type),
 placement: this.formatVocabPlacementLabel(vocab), placementOrder: this.getVocabPlacementSortValue(vocab), sortName: this.getVocabSortName(vocab) };
 }
};
