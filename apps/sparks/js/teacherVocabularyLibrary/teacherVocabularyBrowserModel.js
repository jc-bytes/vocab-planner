import { getSubjectBySlug, getVocabSubjectSlug } from '../services/vocabularyApi.js';
import { filterTeacherVocabularyItems } from './teacherVocabularyModel.js';

// Presentation has only data capabilities. It never acquires a Manager or edits a document.
export function createTeacherVocabularyBrowserModel({ getSubjects, describeVocabulary, describeVocabularyGrouping }) {
 if (typeof getSubjects !== 'function' || typeof describeVocabulary !== 'function' || typeof describeVocabularyGrouping !== 'function') {
     throw new TypeError('Vocabulary browser requires subjects, placement descriptors and grouping data.');
 }
 let descriptors = new WeakMap(), scalarLabels = new Map(), groupingDescriptors = new WeakMap(), groupingInputs = new WeakMap();
 const describe = (vocab, type = '') => {
     let byType = descriptors.get(vocab);
     if (!byType) { byType = new Map(); descriptors.set(vocab, byType); }
     if (!byType.has(type)) byType.set(type, describeVocabulary(groupingInputs.get(vocab) || vocab, type));
     return byType.get(type);
 };
 const grouping = vocab => {
     if (!groupingDescriptors.has(vocab)) {
         const prepared = descriptors.get(vocab)?.get('');
         if (prepared) {
             groupingDescriptors.set(vocab, {
                 grades: prepared.grades.map(grade => grade.value), trimesterKey: prepared.trimester.key
             });
         } else {
             // Later presentation reads must see the same metadata as this grouping.
             const input = { ...vocab };
             if (Array.isArray(vocab.grades)) input.grades = [...vocab.grades];
             groupingInputs.set(vocab, input);
             groupingDescriptors.set(vocab, describeVocabularyGrouping(input));
         }
     }
     return groupingDescriptors.get(vocab);
 };
 const scalar = (kind, key, create) => {
     const id = `${kind}:${key}`;
     if (!scalarLabels.has(id)) scalarLabels.set(id, create());
     return scalarLabels.get(id);
 };
 const trimester = key => scalar('trimester', key, () => describe({ trimester: key }).trimester);
 const month = key => scalar('month', key, () => describe({ month: key }).month);
 const grade = key => scalar('grade', key, () => describe({ grades: [key] }).grades[0]);
 return {
 beginRender() {
     descriptors = new WeakMap(); scalarLabels = new Map();
     groupingDescriptors = new WeakMap(); groupingInputs = new WeakMap();
 },
 getSubjects,
 getVocabGrades: vocab => describe(vocab).grades.map(item => item.value),
 getTeacherTrimesterKey: vocab => describe(vocab).trimester.key,
 getTeacherMonthKey: vocab => describe(vocab).month.key,
 getTeacherTrimesterLabel: key => trimester(key).label,
 getTeacherTrimesterShortLabel: key => trimester(key).shortLabel,
 getTeacherTrimesterOrder: key => trimester(key).order,
 getTeacherMonthLabel: key => month(key).label,
 getTeacherMonthShortLabel: key => month(key).shortLabel,
 getTeacherMonthOrder: key => month(key).order,
 formatGradeLabel: key => grade(key)?.label || '',
 compareGradeLabels: (a,b) => (grade(a)?.order - grade(b)?.order) || (grade(a)?.label || '').localeCompare(grade(b)?.label || ''),
 inferTeacherWeek: vocab => describe(vocab).week,
 getTeacherVocabularyPurpose: (vocab,type) => describe(vocab,type).purpose,
 formatVocabPlacementLabel: vocab => describe(vocab).placement,
 getVocabSortName: vocab => describe(vocab).sortName,
 compareVocabPlacement(a,b) { const x=describe(a),y=describe(b); return x.placementOrder.localeCompare(y.placementOrder) || x.sortName.localeCompare(y.sortName); },
 getSubjectForVocab: vocab => getSubjectBySlug(getSubjects(), getVocabSubjectSlug(vocab)),
 formatUnitCount: count => `${count} ${count === 1 ? 'unit' : 'units'}`,
 buildMonthGroups(items = []) { const groups = new Map(); for (const item of items) { const key = describe(item.vocab).month.key; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); } return groups; },
 formatMonthSummary(groups) { return [...groups].sort(([a],[b])=>month(a).order-month(b).order).map(([key,items])=>`${month(key).shortLabel}: ${items.length}`).join(' · '); },
 buildLibraryGroups(items = this.libraryItems) {
        const subjectGroups = new Map();

        items.forEach(({ vocab, type }) => {
            const subjectSlug = getVocabSubjectSlug(vocab);
            const { grades, trimesterKey } = grouping(vocab);

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
 getTeacherVocabularyItemsForDrilldown(drilldown = {}, items = this.libraryItems) {
        return filterTeacherVocabularyItems(items, drilldown, {
            getGrades: vocab => grouping(vocab).grades,
            getTrimesterKey: vocab => grouping(vocab).trimesterKey,
            getMonthKey: vocab => this.getTeacherMonthKey(vocab)
        });
    },
 getTeacherVocabularyViewDepth(drilldown = this.libraryDrilldown || {}) {
        if (drilldown.month) return 'month';
        if (drilldown.trimester) return 'trimester';
        if (drilldown.grade) return 'grade';
        if (drilldown.subject) return 'subject';
        return 'root';
    },
 getDefaultTeacherVocabularyViewMode(depth = this.getTeacherVocabularyViewDepth()) {
        return 'cards';
    },
 getTeacherVocabularyRowColumns(drilldown = this.libraryDrilldown || {}) {
        return [
            { key: 'grade', label: 'Grade', hidden: Boolean(drilldown.grade) },
            { key: 'trimester', label: 'Trimester', hidden: Boolean(drilldown.trimester) },
            { key: 'month', label: 'Month', hidden: Boolean(drilldown.month) },
            { key: 'week', label: 'Week', hidden: false },
            { key: 'purpose', label: 'Purpose', hidden: false },
            { key: 'words', label: 'Words', hidden: false }
        ].filter(column => !column.hidden);
    },
getTeacherVocabularyRowDepthClass(drilldown = this.libraryDrilldown || {}) {
        if (drilldown.month) return 'teacher-vocab-row-depth-month';
        if (drilldown.trimester) return 'teacher-vocab-row-depth-trimester';
        if (drilldown.grade) return 'teacher-vocab-row-depth-grade';
        return 'teacher-vocab-row-depth-all';
    },
getTeacherVocabularyWordCount(vocab = {}) {
        if (Number.isFinite(Number(vocab.wordCount))) return Number(vocab.wordCount);
        if (Array.isArray(vocab.words)) return vocab.words.length;
        if (Array.isArray(vocab.terms)) return vocab.terms.length;
        if (Array.isArray(vocab.vocabulary)) return vocab.vocabulary.length;
        const explicit = Number(vocab.wordCount ?? vocab.word_count ?? vocab.wordsCount ?? vocab.words_count);
        return Number.isFinite(explicit) && explicit >= 0 ? explicit : 0;
    },
getTeacherVocabularyWeekOrder(vocab = {}) {
        const week = Number.parseInt(vocab?.week || this.inferTeacherWeek(vocab) || '', 10);
        return Number.isFinite(week) && week > 0 ? week : 99;
    },
compareTeacherVocabularyRowOrder(itemA, itemB, drilldown = this.libraryDrilldown || {}) {
        const vocabA = itemA.vocab;
        const vocabB = itemB.vocab;

        if (!drilldown.subject) {
            const subjectCompare = getSubjectBySlug(this.getSubjects(), getVocabSubjectSlug(vocabA)).name
                .localeCompare(getSubjectBySlug(this.getSubjects(), getVocabSubjectSlug(vocabB)).name);
            if (subjectCompare) return subjectCompare;
        }

        if (!drilldown.grade) {
            const gradeCompare = this.compareGradeLabels(this.getVocabGrades(vocabA)[0], this.getVocabGrades(vocabB)[0]);
            if (gradeCompare) return gradeCompare;
        }

        if (!drilldown.trimester) {
            const trimesterCompare = this.getTeacherTrimesterOrder(this.getTeacherTrimesterKey(vocabA))
                - this.getTeacherTrimesterOrder(this.getTeacherTrimesterKey(vocabB));
            if (trimesterCompare) return trimesterCompare;
        }

        if (!drilldown.month) {
            const monthCompare = this.getTeacherMonthOrder(this.getTeacherMonthKey(vocabA))
                - this.getTeacherMonthOrder(this.getTeacherMonthKey(vocabB));
            if (monthCompare) return monthCompare;
        }

        const weekCompare = this.getTeacherVocabularyWeekOrder(vocabA) - this.getTeacherVocabularyWeekOrder(vocabB);
        if (weekCompare) return weekCompare;

        const purposeCompare = this.getTeacherVocabularyPurpose(vocabA, itemA.type)
            .localeCompare(this.getTeacherVocabularyPurpose(vocabB, itemB.type));
        if (purposeCompare) return purposeCompare;

        return this.getVocabSortName(vocabA).localeCompare(this.getVocabSortName(vocabB));
    }
 };
}
