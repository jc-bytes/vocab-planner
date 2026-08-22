import { $, createElement, escapeHtml, notifications } from './main.js';
import {
    getSubjectBySlug,
    getVocabSubjectSlug,
    loadVocabularyFile
} from './services/vocabularyApi.js';

function installMethods(TeacherManager, MethodsClass) {
    for (const name of Object.getOwnPropertyNames(MethodsClass.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(MethodsClass.prototype, name)
        );
    }
}

class TeacherQuizBrowserMethods {
    getQuizVocabularyViewDepth(drilldown = this.libraryDrilldown || {}) {
        return this.getTeacherVocabularyViewDepth(drilldown);
    }

    getDefaultQuizVocabularyViewMode(depth = this.getQuizVocabularyViewDepth()) {
        return this.getDefaultTeacherVocabularyViewMode(depth);
    }

    getStoredQuizVocabularyViewModes() {
        try {
            return JSON.parse(localStorage.getItem('teacher_quiz_vocabulary_view_modes') || '{}') || {};
        } catch {
            return {};
        }
    }

    getQuizVocabularyViewMode(drilldown = this.libraryDrilldown || {}) {
        if (!this.quizVocabularyViewModes) {
            this.quizVocabularyViewModes = this.getStoredQuizVocabularyViewModes();
        }
        const depth = this.getQuizVocabularyViewDepth(drilldown);
        const savedMode = this.quizVocabularyViewModes?.[depth];
        return savedMode === 'rows' || savedMode === 'cards'
            ? savedMode
            : this.getDefaultQuizVocabularyViewMode(depth);
    }

    setQuizVocabularyViewMode(mode) {
        const depth = this.getQuizVocabularyViewDepth();
        this.quizVocabularyViewModes = {
            ...(this.quizVocabularyViewModes || {}),
            [depth]: mode === 'rows' ? 'rows' : 'cards'
        };
        localStorage.setItem('teacher_quiz_vocabulary_view_modes', JSON.stringify(this.quizVocabularyViewModes));
        this.renderQuizVocabularyBrowser();
        this.refreshIcons();
    }

    renderQuizVocabularyViewControls() {
        const container = $('#quiz-vocab-view-toggle');
        if (!container) return;
        const currentMode = this.getQuizVocabularyViewMode();
        container.innerHTML = `
            <button class="vocab-view-toggle-btn ${currentMode === 'cards' ? 'is-active' : ''}" type="button" data-quiz-vocab-view-mode="cards" aria-pressed="${currentMode === 'cards'}" aria-label="Show cards">
                <i data-lucide="layout-grid"></i><span>Cards</span>
            </button>
            <button class="vocab-view-toggle-btn ${currentMode === 'rows' ? 'is-active' : ''}" type="button" data-quiz-vocab-view-mode="rows" aria-pressed="${currentMode === 'rows'}" aria-label="Show rows">
                <i data-lucide="list"></i><span>Rows</span>
            </button>
        `;
        container.querySelectorAll('[data-quiz-vocab-view-mode]').forEach(button => {
            button.addEventListener('click', () => this.setQuizVocabularyViewMode(button.dataset.quizVocabViewMode));
        });
    }

    renderQuizVocabularyBrowser(container = $('#quiz-vocab-picker')) {
        if (!container) return;

        this.renderQuizVocabularyViewControls();
        container.classList.remove('vocab-grid', 'compact-vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const subjectGroups = this.buildLibraryGroups(this.quizLibraryItems);
        const selectedSubject = this.libraryDrilldown.subject;
        const selectedGrade = this.libraryDrilldown.grade;
        const selectedTrimester = this.libraryDrilldown.trimester;
        const selectedMonth = this.libraryDrilldown.month;

        if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
            this.resetLibraryDrilldown();
            if (this.getQuizVocabularyViewMode({}) === 'rows') {
                this.renderQuizBreadcrumb(container);
                this.renderQuizVocabularyRows(container, this.quizLibraryItems || []);
            } else {
                this.renderQuizSubjectPicker(container, subjectGroups);
            }
            return;
        }

        const gradeGroups = subjectGroups.get(selectedSubject);

        if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
            this.libraryDrilldown.grade = null;
            this.libraryDrilldown.trimester = null;
            this.libraryDrilldown.month = null;
            if (this.getQuizVocabularyViewMode({ subject: selectedSubject }) === 'rows') {
                this.renderQuizBreadcrumb(container, selectedSubject);
                this.renderQuizVocabularyRows(container, this.getQuizVocabularyItemsForDrilldown({ subject: selectedSubject }));
            } else {
                this.renderQuizGradePicker(container, selectedSubject, gradeGroups);
            }
            return;
        }

        const trimesterGroups = gradeGroups.get(selectedGrade);

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
            this.libraryDrilldown.trimester = null;
            this.libraryDrilldown.month = null;
            if (this.getQuizVocabularyViewMode({ subject: selectedSubject, grade: selectedGrade }) === 'rows') {
                this.renderQuizBreadcrumb(container, selectedSubject, selectedGrade);
                this.renderQuizVocabularyRows(container, this.getQuizVocabularyItemsForDrilldown({
                    subject: selectedSubject,
                    grade: selectedGrade
                }));
            } else {
                this.renderQuizTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups);
            }
            return;
        }

        const monthGroups = this.buildMonthGroups(trimesterGroups.get(selectedTrimester));

        if (!selectedMonth || !monthGroups.has(selectedMonth)) {
            this.libraryDrilldown.month = null;
            if (this.getQuizVocabularyViewMode({
                subject: selectedSubject,
                grade: selectedGrade,
                trimester: selectedTrimester
            }) === 'rows') {
                this.renderQuizBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester);
                this.renderQuizVocabularyRows(container, trimesterGroups.get(selectedTrimester));
            } else {
                this.renderQuizMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
            }
            return;
        }

        this.renderQuizAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth));
    }

    getQuizVocabularyItemsForDrilldown(drilldown = {}) {
        const previousItems = this.libraryItems;
        this.libraryItems = this.quizLibraryItems || [];
        const items = this.getTeacherVocabularyItemsForDrilldown(drilldown);
        this.libraryItems = previousItems;
        return items;
    }

    renderQuizBreadcrumb(container, selectedSubject = null, selectedGrade = null, selectedTrimester = null, selectedMonth = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');
        nav.dataset.breadcrumbDepth = selectedMonth ? 'month'
            : selectedTrimester ? 'trimester'
                : selectedGrade ? 'grade'
                    : selectedSubject ? 'subject'
                        : 'root';

        const subjectsButton = this.createLibraryBreadcrumbButton('Subjects', () => {
            this.resetLibraryDrilldown();
            this.updateVocabularyRoute();
            this.renderQuizVocabularyBrowser();
        });
        subjectsButton.dataset.crumb = 'root';
        nav.appendChild(subjectsButton);

        if (selectedSubject) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator', '/');
            separator.dataset.beforeCrumb = 'subject';
            nav.appendChild(separator);
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            const subjectButton = selectedGrade || selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(subject.name, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: null, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderQuizVocabularyBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', subject.name);
            subjectButton.dataset.crumb = 'subject';
            nav.appendChild(subjectButton);
        }

        if (selectedGrade) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator', '/');
            separator.dataset.beforeCrumb = 'grade';
            nav.appendChild(separator);
            const gradeLabel = this.formatGradeLabel(selectedGrade);
            const gradeButton = selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(gradeLabel, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderQuizVocabularyBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', gradeLabel);
            gradeButton.dataset.crumb = 'grade';
            nav.appendChild(gradeButton);
        }

        if (selectedTrimester) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator', '/');
            separator.dataset.beforeCrumb = 'trimester';
            nav.appendChild(separator);
            const trimesterLabel = this.getTeacherTrimesterLabel(selectedTrimester);
            const trimesterNode = selectedMonth
                ? this.createLibraryBreadcrumbButton(trimesterLabel, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester, month: null };
                    this.updateVocabularyRoute();
                    this.renderQuizVocabularyBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', trimesterLabel);
            trimesterNode.dataset.crumb = 'trimester';
            nav.appendChild(trimesterNode);
        }

        if (selectedMonth) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator', '/');
            separator.dataset.beforeCrumb = 'month';
            nav.appendChild(separator);
            const monthNode = createElement('span', 'teacher-library-breadcrumb-current', this.getTeacherMonthLabel(selectedMonth));
            monthNode.dataset.crumb = 'month';
            nav.appendChild(monthNode);
        }

        container.appendChild(nav);
    }

    renderQuizSubjectPicker(container, subjectGroups) {
        this.renderQuizBreadcrumb(container);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(subjectGroups.entries())
            .sort(([subjectA], [subjectB]) => {
                const metaA = getSubjectBySlug(this.getSubjects(), subjectA);
                const metaB = getSubjectBySlug(this.getSubjects(), subjectB);
                if (metaA.sortOrder !== metaB.sortOrder) return metaA.sortOrder - metaB.sortOrder;
                return metaA.name.localeCompare(metaB.name);
            })
            .forEach(([subjectSlug, gradeGroups]) => {
                const subject = getSubjectBySlug(this.getSubjects(), subjectSlug);
                const totalUnits = Array.from(gradeGroups.values())
                    .reduce((sum, trimesterGroups) => sum + Array.from(trimesterGroups.values()).reduce((inner, group) => inner + group.length, 0), 0);
                const gradeSummary = Array.from(gradeGroups.keys())
                    .sort((gradeA, gradeB) => this.compareGradeLabels(gradeA, gradeB))
                    .map(grade => this.formatGradeLabel(grade))
                    .join(' · ');
                const card = this.createLibraryChoiceCard({
                    title: subject.name,
                    count: this.formatUnitCount(totalUnits),
                    meta: gradeSummary,
                    icon: 'chevron-right',
                    color: subject.color
                });
                card.addEventListener('click', () => {
                    this.libraryDrilldown = { subject: subjectSlug, grade: null, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderQuizVocabularyBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderQuizGradePicker(container, selectedSubject, gradeGroups) {
        this.renderQuizBreadcrumb(container, selectedSubject);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(gradeGroups.entries())
            .sort(([gradeA], [gradeB]) => this.compareGradeLabels(gradeA, gradeB))
            .forEach(([grade, trimesterGroups]) => {
                const totalUnits = Array.from(trimesterGroups.values()).reduce((sum, group) => sum + group.length, 0);
                const trimesterSummary = Array.from(trimesterGroups.entries())
                    .sort(([trimesterA], [trimesterB]) => this.getTeacherTrimesterOrder(trimesterA) - this.getTeacherTrimesterOrder(trimesterB))
                    .map(([trimesterKey, vocabItems]) => `${this.getTeacherTrimesterShortLabel(trimesterKey)}: ${vocabItems.length}`)
                    .join(' · ');

                const card = this.createLibraryChoiceCard({
                    title: this.formatGradeLabel(grade),
                    count: this.formatUnitCount(totalUnits),
                    meta: trimesterSummary,
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderQuizVocabularyBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderQuizTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups) {
        this.renderQuizBreadcrumb(container, selectedSubject, selectedGrade);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(trimesterGroups.entries())
            .sort(([trimesterA], [trimesterB]) => this.getTeacherTrimesterOrder(trimesterA) - this.getTeacherTrimesterOrder(trimesterB))
            .forEach(([trimesterKey, vocabItems]) => {
                const monthSummary = this.formatMonthSummary(this.buildMonthGroups(vocabItems));
                const card = this.createLibraryChoiceCard({
                    title: this.getTeacherTrimesterLabel(trimesterKey),
                    count: this.formatUnitCount(vocabItems.length),
                    meta: monthSummary || this.formatGradeLabel(selectedGrade),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: trimesterKey, month: null };
                    this.updateVocabularyRoute();
                    this.renderQuizVocabularyBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderQuizMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups) {
        this.renderQuizBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(monthGroups.entries())
            .sort(([monthA], [monthB]) => this.getTeacherMonthOrder(monthA) - this.getTeacherMonthOrder(monthB))
            .forEach(([monthKey, vocabItems]) => {
                const card = this.createLibraryChoiceCard({
                    title: this.getTeacherMonthLabel(monthKey),
                    count: this.formatUnitCount(vocabItems.length),
                    meta: this.formatGradeLabel(selectedGrade),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.libraryDrilldown = {
                        subject: selectedSubject,
                        grade: selectedGrade,
                        trimester: selectedTrimester,
                        month: monthKey
                    };
                    this.updateVocabularyRoute();
                    this.renderQuizVocabularyBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderQuizAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, vocabItems) {
        this.renderQuizBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth);

        if (this.getQuizVocabularyViewMode() === 'rows') {
            this.renderQuizVocabularyRows(container, vocabItems);
            return;
        }

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid compact-vocab-grid');
        vocabItems
            .sort((itemA, itemB) => this.compareVocabPlacement(itemA.vocab, itemB.vocab))
            .forEach(({ vocab, type }) => {
                this.createQuizPickerCard(grid, vocab, type);
            });

        container.appendChild(grid);
    }

    createQuizVocabularyRowList(columns = []) {
        const list = createElement('div', 'student-vocab-row-list teacher-vocab-row-list quiz-vocab-row-list');
        const header = createElement('div', 'student-vocab-row student-vocab-row-header teacher-vocab-row quiz-vocab-row');
        header.classList.add(this.getTeacherVocabularyRowDepthClass());
        header.setAttribute('aria-hidden', 'true');
        header.appendChild(createElement('strong', null, 'Name'));
        columns.forEach(column => header.appendChild(createElement('span', null, column.label)));
        header.appendChild(createElement('span', null, 'Action'));
        header.appendChild(createElement('i'));
        list.appendChild(header);
        return list;
    }

    createQuizVocabularyRow({ vocab, type }, columns = this.getTeacherVocabularyRowColumns()) {
        const grades = this.getVocabGrades(vocab).map(grade => this.formatGradeLabel(grade)).join(', ');
        const trimester = this.getTeacherTrimesterShortLabel(this.getTeacherTrimesterKey(vocab));
        const month = this.getTeacherMonthShortLabel(this.getTeacherMonthKey(vocab));
        const week = vocab?.week || this.inferTeacherWeek(vocab) || '';
        const purpose = this.getTeacherVocabularyPurpose(vocab, type);
        const wordCount = this.getTeacherVocabularyWordCount(vocab);
        const row = createElement('button', 'student-vocab-row teacher-vocab-row quiz-vocab-row');
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
        row.innerHTML = `<strong>${escapeHtml(vocab.name || 'Untitled')}</strong>${columns.map(column => values[column.key]).join('')}<span class="quiz-vocab-row-action"><i data-lucide="file-plus"></i> Build</span><i data-lucide="chevron-right"></i>`;
        const countNode = row.querySelector('[data-vocab-word-count]');
        if (!wordCount && vocab?.path) {
            countNode.dataset.vocabWordCountPath = vocab.path;
        }
        row.addEventListener('click', () => this.openQuizVocabularyItem(vocab, type));
        return row;
    }

    renderQuizVocabularyRows(container, vocabItems = []) {
        if (!vocabItems.length) {
            container.appendChild(createElement('p', 'teacher-empty-state', 'No vocabulary units here yet.'));
            return;
        }

        const columns = this.getTeacherVocabularyRowColumns();
        const list = this.createQuizVocabularyRowList(columns);
        vocabItems
            .slice()
            .sort((itemA, itemB) => this.compareTeacherVocabularyRowOrder(itemA, itemB))
            .forEach(item => list.appendChild(this.createQuizVocabularyRow(item, columns)));
        container.appendChild(list);
        this.hydrateTeacherVocabularyRowWordCounts(list);
    }

    async openQuizVocabularyItem(vocab, type) {
        if (type === 'remote') {
            const data = await loadVocabularyFile(vocab.path);
            if (!data) {
                notifications.error('Could not load that vocabulary.');
                return;
            }
            this.vocabSet = data;
        } else {
            this.vocabSet = JSON.parse(JSON.stringify(vocab));
            this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
            if (type === 'cloud') this.vocabSet.source = 'cloud';
        }
        this.updateFormUI();
        this.renderWords();
        this.updateQuizHubSummary();
        this.openQuizMaker({ returnTo: 'quizzes' });
    }

    createQuizPickerCard(container, vocab, type) {
        const card = createElement('button', 'teacher-vocab-pick-card');
        card.type = 'button';
        const badgeText = type === 'cloud' ? 'Cloud' : type === 'local' ? 'Draft' : 'Repo';
        const grades = Array.isArray(vocab.grades) ? vocab.grades.join(', ') : (vocab.grade || '');
        const subject = this.getSubjectForVocab(vocab);
        const placement = this.formatVocabPlacementLabel(vocab);
        card.innerHTML = `
            <span class="teacher-source-badge">${badgeText}</span>
            <span class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</span>
            <strong>${escapeHtml(vocab.name || 'Untitled')}</strong>
            <small>${escapeHtml(vocab.id || '')}${grades ? ` · Grade ${escapeHtml(grades)}` : ''}</small>
            ${placement ? `<small>${escapeHtml(placement)}</small>` : ''}
            <span class="teacher-pick-action"><i data-lucide="file-plus"></i> Build quiz</span>
        `;
        card.addEventListener('click', () => this.openQuizVocabularyItem(vocab, type));
        container.appendChild(card);
    }
}

export function installTeacherQuizBrowserMethods(TeacherManager) {
    installMethods(TeacherManager, TeacherQuizBrowserMethods);
}
