import { createElement, escapeHtml } from '../main.js';
import { getSubjectBySlug, getVocabSubjectSlug, loadVocabularyFile } from '../services/vocabularyApi.js';

export const teacherVocabularyRowViewMethods = {
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

createTeacherVocabularyRowList(columns = []) {
        const list = createElement('div', 'student-vocab-row-list teacher-vocab-row-list');
        const header = createElement('div', 'student-vocab-row student-vocab-row-header teacher-vocab-row');
        header.classList.add(this.getTeacherVocabularyRowDepthClass());
        header.setAttribute('aria-hidden', 'true');
        header.appendChild(createElement('strong', null, 'Name'));
        columns.forEach(column => header.appendChild(createElement('span', null, column.label)));
        header.appendChild(createElement('i'));
        list.appendChild(header);
        return list;
    },

createTeacherVocabularyRow({ vocab, type }, columns = this.getTeacherVocabularyRowColumns()) {
        const grades = this.getVocabGrades(vocab).map(grade => this.formatGradeLabel(grade)).join(', ');
        const trimester = this.getTeacherTrimesterShortLabel(this.getTeacherTrimesterKey(vocab));
        const month = this.getTeacherMonthShortLabel(this.getTeacherMonthKey(vocab));
        const week = vocab?.week || this.inferTeacherWeek(vocab) || '';
        const purpose = this.getTeacherVocabularyPurpose(vocab, type);
        const wordCount = this.getTeacherVocabularyWordCount(vocab);
        const row = createElement('button', 'student-vocab-row teacher-vocab-row');
        row.classList.add(this.getTeacherVocabularyRowDepthClass());
        row.type = 'button';
        const values = {
            grade: `<span>${escapeHtml(grades || 'Other')}</span>`,
            trimester: `<span>${escapeHtml(trimester)}</span>`,
            month: `<span>${escapeHtml(month)}</span>`,
            week: `<span>${escapeHtml(week ? `Week ${week}` : 'No week')}</span>`,
            purpose: `<span class="student-vocab-purpose">${escapeHtml(purpose || 'Unit')}</span>`,
            words: `<span data-vocab-word-count>${escapeHtml(wordCount ? `${wordCount}` : '...')}</span>`
        };
        row.innerHTML = `<strong>${escapeHtml(vocab.name || 'Untitled')}</strong>${columns.map(column => values[column.key]).join('')}<i data-lucide="chevron-right"></i>`;
        const countNode = row.querySelector('[data-vocab-word-count]');
        if (!wordCount && vocab?.path) {
            countNode.dataset.vocabWordCountPath = vocab.path;
        }
        row.addEventListener('click', () => this.openTeacherVocabularyItem(vocab, type));
        return row;
    },

getTeacherVocabularyWordCount(vocab = {}) {
        if (Number.isFinite(Number(vocab.wordCount))) return Number(vocab.wordCount);
        if (Array.isArray(vocab.words)) return vocab.words.length;
        if (Array.isArray(vocab.terms)) return vocab.terms.length;
        if (Array.isArray(vocab.vocabulary)) return vocab.vocabulary.length;
        const explicit = Number(vocab.wordCount ?? vocab.word_count ?? vocab.wordsCount ?? vocab.words_count);
        return Number.isFinite(explicit) && explicit >= 0 ? explicit : 0;
    },

hydrateTeacherVocabularyRowWordCounts(container) {
        const countNodes = Array.from(container.querySelectorAll('[data-vocab-word-count-path]'));
        const paths = Array.from(new Set(countNodes.map(node => node.dataset.vocabWordCountPath).filter(Boolean)));
        paths.forEach(async path => {
            const data = await loadVocabularyFile(path, { silent: true });
            const count = this.getTeacherVocabularyWordCount(data || {});
            countNodes
                .filter(node => node.dataset.vocabWordCountPath === path)
                .forEach(node => {
                    node.textContent = String(count);
                    delete node.dataset.vocabWordCountPath;
                });
        });
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
    },

renderTeacherVocabularyRows(container, vocabItems = []) {
        if (!vocabItems.length) {
            container.appendChild(createElement('p', 'teacher-empty-state', 'No vocabulary units here yet.'));
            return;
        }

        const columns = this.getTeacherVocabularyRowColumns();
        const list = this.createTeacherVocabularyRowList(columns);
        vocabItems
            .slice()
            .sort((itemA, itemB) => this.compareTeacherVocabularyRowOrder(itemA, itemB))
            .forEach(item => list.appendChild(this.createTeacherVocabularyRow(item, columns)));
        container.appendChild(list);
        this.hydrateTeacherVocabularyRowWordCounts(list);
    }
};

