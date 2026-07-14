import { $, createElement, escapeHtml } from './main.js';
import {
    getSubjectBySlug,
    getVocabSubjectSlug,
    loadVocabularyFile,
    loadManifest
} from './services/vocabularyApi.js';

class TeacherVocabularyLibraryMethods {
    getTeacherVocabularyViewDepth(drilldown = this.libraryDrilldown || {}) {
        if (drilldown.month) return 'month';
        if (drilldown.trimester) return 'trimester';
        if (drilldown.grade) return 'grade';
        if (drilldown.subject) return 'subject';
        return 'root';
    }

    getDefaultTeacherVocabularyViewMode(depth = this.getTeacherVocabularyViewDepth()) {
        return ['trimester', 'month'].includes(depth) ? 'rows' : 'cards';
    }

    getTeacherVocabularyViewMode(drilldown = this.libraryDrilldown || {}) {
        const depth = this.getTeacherVocabularyViewDepth(drilldown);
        const savedMode = this.teacherVocabularyViewModes?.[depth];
        return savedMode === 'rows' || savedMode === 'cards'
            ? savedMode
            : this.getDefaultTeacherVocabularyViewMode(depth);
    }

    setTeacherVocabularyViewMode(mode) {
        const depth = this.getTeacherVocabularyViewDepth();
        this.teacherVocabularyViewModes = {
            ...(this.teacherVocabularyViewModes || {}),
            [depth]: mode === 'rows' ? 'rows' : 'cards'
        };
        localStorage.setItem('teacher_vocabulary_view_modes', JSON.stringify(this.teacherVocabularyViewModes));
        this.renderLibraryBrowser();
        this.refreshIcons();
    }

    renderTeacherVocabularyViewControls() {
        const container = $('#teacher-vocab-view-toggle');
        if (!container) return;
        const currentMode = this.getTeacherVocabularyViewMode();
        container.innerHTML = `
            <button class="vocab-view-toggle-btn ${currentMode === 'cards' ? 'is-active' : ''}" type="button" data-teacher-vocab-view-mode="cards" aria-pressed="${currentMode === 'cards'}" aria-label="Show cards">
                <i data-lucide="layout-grid"></i><span>Cards</span>
            </button>
            <button class="vocab-view-toggle-btn ${currentMode === 'rows' ? 'is-active' : ''}" type="button" data-teacher-vocab-view-mode="rows" aria-pressed="${currentMode === 'rows'}" aria-label="Show rows">
                <i data-lucide="list"></i><span>Rows</span>
            </button>
        `;
        container.querySelectorAll('[data-teacher-vocab-view-mode]').forEach(button => {
            button.addEventListener('click', () => this.setTeacherVocabularyViewMode(button.dataset.teacherVocabViewMode));
        });
    }

    setVocabularyWorkflowTab(mode = 'assign', options = {}) {
        const nextMode = ['review', 'quizzes'].includes(mode) ? mode : 'assign';
        this.vocabularyMode = nextMode;

        [
            ['assign', '#vocabulary-tab-assign', '#vocabulary-assign-panel'],
            ['review', '#vocabulary-tab-review', '#vocabulary-review-panel'],
            ['quizzes', '#vocabulary-tab-quizzes', '#vocabulary-quizzes-panel']
        ].forEach(([tabMode, tabSelector, panelSelector]) => {
            const active = tabMode === nextMode;
            const tab = $(tabSelector);
            const panel = $(panelSelector);
            tab?.classList.toggle('active', active);
            tab?.classList.toggle('secondary-tab--active', active);
            tab?.setAttribute('aria-selected', active ? 'true' : 'false');
            tab && (tab.tabIndex = active ? 0 : -1);
            panel?.classList.toggle('hidden', !active);
        });

        if (nextMode === 'review' && options.loadReview !== false) {
            this.loadWordHuntReview({ forceRefresh: options.forceRefresh === true });
        }

        if (nextMode === 'quizzes' && options.loadQuizzes !== false) {
            this.showQuizzesView({ updateRoute: false });
        }

        if (options.updateRoute !== false) {
            this.updateVocabularyRoute({ replace: options.replace === true });
        }
        this.refreshIcons();
    }

    showVocabularyLibrary() {
        if (!this.ensureAuthenticated(false)) return;
        this.vocabularyMode = 'assign';
        this.resetLibraryDrilldown();
        this.switchView('teacher-dashboard-view');
        this.setVocabularyWorkflowTab('assign', { updateRoute: false });
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
    }

    getTeacherVocabularyItemPriority(type = '') {
        return { cloud: 3, local: 2, remote: 1 }[type] || 0;
    }

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
    }

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
    }

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
    }

    mergeTeacherVocabularyItems(existingItem, incomingItem) {
        const existingPriority = this.getTeacherVocabularyItemPriority(existingItem?.type);
        const incomingPriority = this.getTeacherVocabularyItemPriority(incomingItem?.type);
        const primary = incomingPriority > existingPriority ? incomingItem : existingItem;
        const fallback = primary === incomingItem ? existingItem : incomingItem;

        return {
            type: primary.type,
            vocab: this.mergeTeacherVocabularyMetadata(primary.vocab, fallback.vocab)
        };
    }

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
    }

    getTeacherVocabularyItemsForDrilldown(drilldown = {}) {
        const subject = drilldown.subject || null;
        const grade = drilldown.grade || null;
        const trimester = drilldown.trimester || null;
        const month = drilldown.month || null;

        return (this.libraryItems || []).filter(({ vocab }) => {
            if (subject && getVocabSubjectSlug(vocab) !== subject) return false;
            if (grade && !this.getVocabGrades(vocab).includes(grade)) return false;
            if (trimester && this.getTeacherTrimesterKey(vocab) !== trimester) return false;
            if (month && this.getTeacherMonthKey(vocab) !== month) return false;
            return true;
        });
    }

    openTeacherVocabularyItem(vocab, type) {
        if (type === 'remote') {
            this.loadVocabularyFromPath(vocab.path);
        } else if (type === 'cloud') {
            this.loadVocabularyObject(vocab, { source: 'cloud' });
        } else {
            this.loadLocalVocabulary(vocab);
        }
    }

    getTeacherVocabularyRowColumns(drilldown = this.libraryDrilldown || {}) {
        return [
            { key: 'grade', label: 'Grade', hidden: Boolean(drilldown.grade) },
            { key: 'trimester', label: 'Trimester', hidden: Boolean(drilldown.trimester) },
            { key: 'month', label: 'Month', hidden: Boolean(drilldown.month) },
            { key: 'week', label: 'Week', hidden: false },
            { key: 'purpose', label: 'Purpose', hidden: false },
            { key: 'words', label: 'Words', hidden: false }
        ].filter(column => !column.hidden);
    }

    getTeacherVocabularyRowDepthClass(drilldown = this.libraryDrilldown || {}) {
        if (drilldown.month) return 'teacher-vocab-row-depth-month';
        if (drilldown.trimester) return 'teacher-vocab-row-depth-trimester';
        if (drilldown.grade) return 'teacher-vocab-row-depth-grade';
        return 'teacher-vocab-row-depth-all';
    }

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
    }

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
    }

    getTeacherVocabularyWordCount(vocab = {}) {
        if (Array.isArray(vocab.words)) return vocab.words.length;
        if (Array.isArray(vocab.terms)) return vocab.terms.length;
        if (Array.isArray(vocab.vocabulary)) return vocab.vocabulary.length;
        const explicit = Number(vocab.wordCount ?? vocab.word_count ?? vocab.wordsCount ?? vocab.words_count);
        return Number.isFinite(explicit) && explicit >= 0 ? explicit : 0;
    }

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
    }

    getTeacherVocabularyWeekOrder(vocab = {}) {
        const week = Number.parseInt(vocab?.week || this.inferTeacherWeek(vocab) || '', 10);
        return Number.isFinite(week) && week > 0 ? week : 99;
    }

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
    }

    createLibraryBreadcrumbButton(label, onClick, semanticClass = '') {
        const button = createElement('button', ['teacher-library-crumb-btn', semanticClass].filter(Boolean).join(' '), label);
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
    }

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
