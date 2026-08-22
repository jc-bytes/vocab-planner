import { $, createElement } from '../main.js';
import { getSubjectBySlug } from '../services/vocabularyApi.js';

export const teacherVocabularyBrowserViewMethods = {
renderLibraryBrowser(container = $('#library-list')) {
        if (!container) return;

        this.renderTeacherVocabularyViewControls();
        container.classList.remove('vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const subjectGroups = this.buildLibraryGroups();
        const selectedSubject = this.libraryDrilldown.subject;
        const selectedGrade = this.libraryDrilldown.grade;
        const selectedTrimester = this.libraryDrilldown.trimester;
        const selectedMonth = this.libraryDrilldown.month;

        if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
            this.resetLibraryDrilldown();
            if (this.getTeacherVocabularyViewMode({}) === 'rows') {
                this.renderLibraryBreadcrumb(container);
                this.renderTeacherVocabularyRows(container, this.libraryItems || []);
            } else {
                this.renderSubjectPicker(container, subjectGroups);
            }
            return;
        }

        const gradeGroups = subjectGroups.get(selectedSubject);

        if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
            this.libraryDrilldown.grade = null;
            this.libraryDrilldown.trimester = null;
            this.libraryDrilldown.month = null;
            if (this.getTeacherVocabularyViewMode({ subject: selectedSubject }) === 'rows') {
                this.renderLibraryBreadcrumb(container, selectedSubject);
                this.renderTeacherVocabularyRows(container, this.getTeacherVocabularyItemsForDrilldown({ subject: selectedSubject }));
            } else {
                this.renderGradePicker(container, selectedSubject, gradeGroups);
            }
            return;
        }

        const trimesterGroups = gradeGroups.get(selectedGrade);

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
            this.libraryDrilldown.trimester = null;
            this.libraryDrilldown.month = null;
            if (this.getTeacherVocabularyViewMode({ subject: selectedSubject, grade: selectedGrade }) === 'rows') {
                this.renderLibraryBreadcrumb(container, selectedSubject, selectedGrade);
                this.renderTeacherVocabularyRows(container, this.getTeacherVocabularyItemsForDrilldown({
                    subject: selectedSubject,
                    grade: selectedGrade
                }));
            } else {
                this.renderTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups);
            }
            return;
        }

        const monthGroups = this.buildMonthGroups(trimesterGroups.get(selectedTrimester));

        if (!selectedMonth || !monthGroups.has(selectedMonth)) {
            this.libraryDrilldown.month = null;
            if (this.getTeacherVocabularyViewMode({
                subject: selectedSubject,
                grade: selectedGrade,
                trimester: selectedTrimester
            }) === 'rows') {
                this.renderLibraryBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester);
                this.renderTeacherVocabularyRows(container, trimesterGroups.get(selectedTrimester));
            } else {
                this.renderMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
            }
            return;
        }

        this.renderAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth));
    },

renderLibraryBreadcrumb(container, selectedSubject = null, selectedGrade = null, selectedTrimester = null, selectedMonth = null) {
        const host = $('#teacher-vocab-breadcrumb') || container;
        host.innerHTML = '';
        const nav = createElement('div', 'teacher-library-breadcrumb breadcrumb');
        nav.dataset.breadcrumbDepth = selectedMonth ? 'month'
            : selectedTrimester ? 'trimester'
                : selectedGrade ? 'grade'
                    : selectedSubject ? 'subject'
                        : 'root';

        const subjectsButton = this.createLibraryBreadcrumbButton('Subjects', () => {
            this.resetLibraryDrilldown();
            this.updateVocabularyRoute();
            this.renderLibraryBrowser();
        }, 'breadcrumb__item');
        if (!selectedSubject) subjectsButton.setAttribute('aria-current', 'page');
        subjectsButton.dataset.crumb = 'root';
        nav.appendChild(subjectsButton);

        if (selectedSubject) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator breadcrumb__separator', '/');
            separator.dataset.beforeCrumb = 'subject';
            nav.appendChild(separator);
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            const subjectButton = selectedGrade || selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(subject.name, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: null, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                }, 'breadcrumb__item')
                : createElement('span', 'teacher-library-breadcrumb-current breadcrumb__current', subject.name);
            if (!selectedGrade && !selectedTrimester && !selectedMonth) subjectButton.setAttribute('aria-current', 'page');
            subjectButton.dataset.crumb = 'subject';
            nav.appendChild(subjectButton);
        }

        if (selectedGrade) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator breadcrumb__separator', '/');
            separator.dataset.beforeCrumb = 'grade';
            nav.appendChild(separator);
            const gradeLabel = this.formatGradeLabel(selectedGrade);
            const gradeButton = selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(gradeLabel, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                }, 'breadcrumb__item')
                : createElement('span', 'teacher-library-breadcrumb-current breadcrumb__current', gradeLabel);
            if (!selectedTrimester && !selectedMonth) gradeButton.setAttribute('aria-current', 'page');
            gradeButton.dataset.crumb = 'grade';
            nav.appendChild(gradeButton);
        }

        if (selectedTrimester) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator breadcrumb__separator', '/');
            separator.dataset.beforeCrumb = 'trimester';
            nav.appendChild(separator);
            const trimesterLabel = this.getTeacherTrimesterLabel(selectedTrimester);
            const trimesterNode = selectedMonth
                ? this.createLibraryBreadcrumbButton(trimesterLabel, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                }, 'breadcrumb__item')
                : createElement('span', 'teacher-library-breadcrumb-current breadcrumb__current', trimesterLabel);
            if (!selectedMonth) trimesterNode.setAttribute('aria-current', 'page');
            trimesterNode.dataset.crumb = 'trimester';
            nav.appendChild(trimesterNode);
        }

        if (selectedMonth) {
            const separator = createElement('span', 'teacher-library-breadcrumb-separator breadcrumb__separator', '/');
            separator.dataset.beforeCrumb = 'month';
            nav.appendChild(separator);
            const monthNode = createElement('span', 'teacher-library-breadcrumb-current breadcrumb__current', this.getTeacherMonthLabel(selectedMonth));
            monthNode.setAttribute('aria-current', 'page');
            monthNode.dataset.crumb = 'month';
            nav.appendChild(monthNode);
        }

        host.appendChild(nav);
    },

createLibraryBreadcrumbButton(label, onClick, semanticClass = '') {
        const button = createElement('button', ['teacher-library-crumb-btn', semanticClass].filter(Boolean).join(' '), label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    },

renderSubjectPicker(container, subjectGroups) {
        this.renderLibraryBreadcrumb(container);

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
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    },

renderGradePicker(container, selectedSubject, gradeGroups) {
        this.renderLibraryBreadcrumb(container, selectedSubject);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(gradeGroups.entries())
            .sort(([gradeA], [gradeB]) => this.compareGradeLabels(gradeA, gradeB))
            .forEach(([grade, trimesterGroups]) => {
                const totalUnits = Array.from(trimesterGroups.values()).reduce((sum, group) => sum + group.length, 0);
                const trimesterSummary = Array.from(trimesterGroups.entries())
                    .sort(([trimesterA], [trimesterB]) => {
                        return this.getTeacherTrimesterOrder(trimesterA) - this.getTeacherTrimesterOrder(trimesterB);
                    })
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
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    },

renderTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups) {
        this.renderLibraryBreadcrumb(container, selectedSubject, selectedGrade);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(trimesterGroups.entries())
            .sort(([trimesterA], [trimesterB]) => {
                return this.getTeacherTrimesterOrder(trimesterA) - this.getTeacherTrimesterOrder(trimesterB);
            })
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
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    },

renderMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups) {
        this.renderLibraryBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester);

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
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    },

renderAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, vocabItems) {
        this.renderLibraryBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth);

        if (this.getTeacherVocabularyViewMode() === 'rows') {
            this.renderTeacherVocabularyRows(container, vocabItems);
            return;
        }

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid');
        vocabItems
            .sort((itemA, itemB) => this.compareVocabPlacement(itemA.vocab, itemB.vocab))
            .forEach(({ vocab, type }) => {
                this.createLibraryCard(grid, vocab, type);
            });

        container.appendChild(grid);
    },

createLibraryChoiceCard({ title, count, meta, icon, color = '' }) {
        const card = createElement('button', 'teacher-library-choice-card');
        card.type = 'button';

        const text = createElement('span', 'teacher-library-choice-text');
        const titleEl = createElement('strong', 'card-title', title);
        const countEl = createElement('span', 'teacher-library-choice-count card-secondary', count);
        if (color) {
            const dot = createElement('span', 'subject-color-dot');
            dot.style.background = color;
            text.appendChild(dot);
        }
        text.append(titleEl, countEl);

        if (meta) {
            text.appendChild(createElement('small', 'card-caption', meta));
        }

        card.appendChild(text);

        if (icon) {
            const iconEl = createElement('i');
            iconEl.setAttribute('data-lucide', icon);
            card.appendChild(iconEl);
        }

        return card;
    }
};

