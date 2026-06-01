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
    renderQuizVocabularyBrowser(container = $('#quiz-vocab-picker')) {
        if (!container) return;

        container.classList.remove('vocab-grid', 'compact-vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const subjectGroups = this.buildLibraryGroups(this.quizLibraryItems);
        const selectedSubject = this.quizDrilldown.subject;
        const selectedGrade = this.quizDrilldown.grade;
        const selectedTrimester = this.quizDrilldown.trimester;
        const selectedMonth = this.quizDrilldown.month;

        if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
            this.resetQuizDrilldown();
            this.renderQuizSubjectPicker(container, subjectGroups);
            return;
        }

        const gradeGroups = subjectGroups.get(selectedSubject);

        if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
            this.quizDrilldown.grade = null;
            this.quizDrilldown.trimester = null;
            this.quizDrilldown.month = null;
            this.renderQuizGradePicker(container, selectedSubject, gradeGroups);
            return;
        }

        const trimesterGroups = gradeGroups.get(selectedGrade);

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
            this.quizDrilldown.trimester = null;
            this.quizDrilldown.month = null;
            this.renderQuizTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups);
            return;
        }

        const monthGroups = this.buildMonthGroups(trimesterGroups.get(selectedTrimester));

        if (!selectedMonth || !monthGroups.has(selectedMonth)) {
            this.quizDrilldown.month = null;
            this.renderQuizMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
            return;
        }

        this.renderQuizAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth));
    }

    renderQuizBreadcrumb(container, selectedSubject = null, selectedGrade = null, selectedTrimester = null, selectedMonth = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');

        const subjectsButton = this.createLibraryBreadcrumbButton('Subjects', () => {
            this.resetQuizDrilldown();
            this.renderQuizVocabularyBrowser();
        });
        nav.appendChild(subjectsButton);

        if (selectedSubject) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            const subjectButton = selectedGrade || selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(subject.name, () => {
                    this.quizDrilldown = { subject: selectedSubject, grade: null, trimester: null, month: null };
                    this.renderQuizVocabularyBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', subject.name);
            nav.appendChild(subjectButton);
        }

        if (selectedGrade) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const gradeLabel = this.formatGradeLabel(selectedGrade);
            const gradeButton = selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(gradeLabel, () => {
                    this.quizDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: null, month: null };
                    this.renderQuizVocabularyBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', gradeLabel);
            nav.appendChild(gradeButton);
        }

        if (selectedTrimester) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const trimesterLabel = this.getTeacherTrimesterLabel(selectedTrimester);
            const trimesterNode = selectedMonth
                ? this.createLibraryBreadcrumbButton(trimesterLabel, () => {
                    this.quizDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester, month: null };
                    this.renderQuizVocabularyBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', trimesterLabel);
            nav.appendChild(trimesterNode);
        }

        if (selectedMonth) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-current', this.getTeacherMonthLabel(selectedMonth)));
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
                    this.quizDrilldown = { subject: subjectSlug, grade: null, trimester: null, month: null };
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
                    this.quizDrilldown = { subject: selectedSubject, grade, trimester: null, month: null };
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
                    this.quizDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: trimesterKey, month: null };
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
                    this.quizDrilldown = {
                        subject: selectedSubject,
                        grade: selectedGrade,
                        trimester: selectedTrimester,
                        month: monthKey
                    };
                    this.renderQuizVocabularyBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderQuizAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, vocabItems) {
        this.renderQuizBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth);

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid compact-vocab-grid');
        vocabItems
            .sort((itemA, itemB) => this.compareVocabPlacement(itemA.vocab, itemB.vocab))
            .forEach(({ vocab, type }) => {
                this.createQuizPickerCard(grid, vocab, type);
            });

        container.appendChild(grid);
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
        card.addEventListener('click', async () => {
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
        });
        container.appendChild(card);
    }
}

export function installTeacherQuizBrowserMethods(TeacherManager) {
    installMethods(TeacherManager, TeacherQuizBrowserMethods);
}

