import { $, createElement } from './main.js';
import {
    getSubjectBySlug,
    getVocabSubjectSlug,
    loadManifest
} from './services/vocabularyApi.js';

class TeacherVocabularyLibraryMethods {
    showVocabularyLibrary() {
        if (!this.ensureAuthenticated(false)) return;
        this.resetLibraryDrilldown();
        this.switchView('teacher-dashboard-view');
        this.loadLibrary();
    }

    ensureAuthenticated(showAlert = true) {
        if (this.authDisabled) {
            return true;
        }
        if (!this.isAuthenticated) {
            if (showAlert) {
                alert('Please sign in to use the teacher tools.');
            }
            this.showLoginView();
            return false;
        }
        return true;
    }

    invalidateTeacherLibraryCache() {
        this.teacherLibraryCache = null;
        this.teacherLibraryPromise = null;
    }

    invalidateStudentProgressCache() {
        this.studentProgressCache = null;
        this.studentProgressPromise = null;
        this.allStudentData = [];
        this.filteredStudentData = [];
    }

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
            const items = [
                ...cloudVocabs.map(vocab => ({ vocab, type: 'cloud' })),
                ...remoteVocabs.map(vocab => ({ vocab, type: 'remote' })),
                ...localVocabs.map(vocab => ({ vocab, type: 'local' }))
            ];

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
    }

    async loadLibrary() {
        const list = $('#library-list');
        if (!list) return;

        if (!this.authDisabled && !this.isAuthenticated) {
            list.innerHTML = '<p>Please sign in to view the library.</p>';
            return;
        }

        list.innerHTML = '<div class="loading-spinner">Loading library...</div>';

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
    }

    resetLibraryDrilldown() {
        this.libraryDrilldown = {
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
    }

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
    }

    renderLibraryBrowser(container = $('#library-list')) {
        if (!container) return;

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
            this.renderSubjectPicker(container, subjectGroups);
            return;
        }

        const gradeGroups = subjectGroups.get(selectedSubject);

        if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
            this.libraryDrilldown.grade = null;
            this.libraryDrilldown.trimester = null;
            this.libraryDrilldown.month = null;
            this.renderGradePicker(container, selectedSubject, gradeGroups);
            return;
        }

        const trimesterGroups = gradeGroups.get(selectedGrade);

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
            this.libraryDrilldown.trimester = null;
            this.libraryDrilldown.month = null;
            this.renderTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups);
            return;
        }

        const monthGroups = this.buildMonthGroups(trimesterGroups.get(selectedTrimester));

        if (!selectedMonth || !monthGroups.has(selectedMonth)) {
            this.libraryDrilldown.month = null;
            this.renderMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
            return;
        }

        this.renderAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth));
    }

    renderLibraryBreadcrumb(container, selectedSubject = null, selectedGrade = null, selectedTrimester = null, selectedMonth = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');

        const subjectsButton = this.createLibraryBreadcrumbButton('Subjects', () => {
            this.resetLibraryDrilldown();
            this.updateVocabularyRoute();
            this.renderLibraryBrowser();
        });
        nav.appendChild(subjectsButton);

        if (selectedSubject) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            const subjectButton = selectedGrade || selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(subject.name, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: null, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', subject.name);
            nav.appendChild(subjectButton);
        }

        if (selectedGrade) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const gradeLabel = this.formatGradeLabel(selectedGrade);
            const gradeButton = selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(gradeLabel, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', gradeLabel);
            nav.appendChild(gradeButton);
        }

        if (selectedTrimester) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const trimesterLabel = this.getTeacherTrimesterLabel(selectedTrimester);
            const trimesterNode = selectedMonth
                ? this.createLibraryBreadcrumbButton(trimesterLabel, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
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

    createLibraryBreadcrumbButton(label, onClick) {
        const button = createElement('button', 'teacher-library-crumb-btn', label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }

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
    }

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
    }

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
    }

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
    }

    renderAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, vocabItems) {
        this.renderLibraryBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth);

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid');
        vocabItems
            .sort((itemA, itemB) => this.compareVocabPlacement(itemA.vocab, itemB.vocab))
            .forEach(({ vocab, type }) => {
                this.createLibraryCard(grid, vocab, type);
            });

        container.appendChild(grid);
    }

    createLibraryChoiceCard({ title, count, meta, icon, color = '' }) {
        const card = createElement('button', 'teacher-library-choice-card');
        card.type = 'button';

        const text = createElement('span', 'teacher-library-choice-text');
        const titleEl = createElement('strong', null, title);
        const countEl = createElement('span', 'teacher-library-choice-count', count);
        if (color) {
            const dot = createElement('span', 'subject-color-dot');
            dot.style.background = color;
            text.appendChild(dot);
        }
        text.append(titleEl, countEl);

        if (meta) {
            text.appendChild(createElement('small', null, meta));
        }

        card.appendChild(text);

        if (icon) {
            const iconEl = createElement('i');
            iconEl.setAttribute('data-lucide', icon);
            card.appendChild(iconEl);
        }

        return card;
    }
}

export function installTeacherVocabularyLibraryMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherVocabularyLibraryMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherVocabularyLibraryMethods.prototype, name)
        );
    }
}
