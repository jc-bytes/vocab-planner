import { createVocabularyCard, formatVocabularyCardTitle, formatVocabularyCardDescription } from './vocabularyCardView.js';
import { renderLibraryViewToggle, createLibraryRowList, createLibraryRow } from './learningLibraryView.js';
import { filterLibraryItems, renderLibraryControls, renderLibraryEmpty } from './teacherLibraryControls.js';
import { $, createElement } from './main.js';
import { getVocabSubjectSlug } from './services/vocabularyApi.js';
import { bindFloatingActionMenu } from './ui/floatingActionMenu.js';
import { resolveQuizVocabularyItem } from './teacherQuizVocabularyResolver.js';

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
    getQuizVocabularyViewDepth(drilldown = this.quizDrilldown || {}) {
        return this.vocabularyBrowser.getViewDepth(drilldown);
    }

    getDefaultQuizVocabularyViewMode(depth = this.getQuizVocabularyViewDepth()) {
        return this.vocabularyBrowser.getDefaultViewMode(depth);
    }

    getStoredQuizVocabularyViewModes() {
        try {
            return JSON.parse(this.storage.getItem(this.getOwnedStorageKey('teacher_quiz_vocabulary_view_modes')) || '{}') || {};
        } catch {
            return {};
        }
    }

    getQuizVocabularyViewMode(drilldown = this.quizDrilldown || {}) {
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
        if (this.destroyed) return;
        const depth = this.getQuizVocabularyViewDepth();
        this.quizVocabularyViewModes = {
            ...(this.quizVocabularyViewModes || {}),
            [depth]: mode === 'rows' ? 'rows' : 'cards'
        };
        this.storage.setItem(
            this.getOwnedStorageKey('teacher_quiz_vocabulary_view_modes'),
            JSON.stringify(this.quizVocabularyViewModes)
        );
        this.renderQuizVocabularyBrowser();
        this.refreshIcons();
    }

    renderQuizVocabularyViewControls() {
        const container = $('#quiz-vocab-view-toggle');
        if (!container) return;
        renderLibraryViewToggle(container, this.getQuizVocabularyViewMode(), mode => this.setQuizVocabularyViewMode(mode), 'data-quiz-vocab-view-mode');
    }

    renderQuizVocabularyBrowser(container = $('#quiz-vocab-picker')) {
        if (!container) return;
        this.vocabularyBrowser.beginRender();
        this.renderQuizVocabularyViewControls();
        container.classList.remove('vocab-grid', 'compact-vocab-grid');
        void import('../css/teacher-student-library.css');
        container.classList.add('teacher-library-browser', 'teacher-student-library');
        container.innerHTML = '';

        const state = this.quizSearchState ||= { status: 'current', query: '', grade: '', trimester: '' };
        renderLibraryControls($('#quiz-library-filters'), { state, onChange: () => {
            this.renderQuizVocabularyBrowser();
        } });
        const scoped = this.vocabularyBrowser.filterItems(this.vocabularyBrowser.filterItems(this.quizLibraryItems || [], this.quizDrilldown), { grade: state.grade, trimester: state.trimester });
        const items = filterLibraryItems(scoped, { ...state, grade: '', trimester: '' }, {
            getGrades: () => [], getTrimester: () => ''
        });
        container.classList.toggle('teacher-library-folders-rows', this.getQuizVocabularyViewMode() === 'rows');
        const onNavigate = drilldown => {
            this.quizDrilldown = drilldown; this.updateQuizRoute(); this.renderQuizVocabularyBrowser(); this.refreshIcons();
        };
        const breadcrumbHost = $('#quiz-vocab-breadcrumb') || container;
        this.vocabularyBrowser.renderBreadcrumb({ container, breadcrumbHost, drilldown: this.quizDrilldown, onNavigate });
        const count = $('#quiz-library-result-count');
        if (count) count.textContent = `${items.length} vocabulary ${items.length === 1 ? 'set' : 'sets'}`;
        if (!items.length) {
            renderLibraryEmpty(container, 'No vocabulary sets match these filters. Clear filters to see more materials.');
            return;
        }
        this.vocabularyBrowser.renderHierarchy({
            container,
            breadcrumbHost,
            items,
            drilldown: this.quizDrilldown,
            getViewMode: drilldown => this.getQuizVocabularyViewMode(drilldown),
            resetDrilldown: () => this.resetQuizDrilldown(),
            filterItems: drilldown => this.vocabularyBrowser.filterItems(items, drilldown),
            onNavigate: drilldown => {
                this.quizDrilldown = drilldown;
                this.updateQuizRoute();
                this.renderQuizVocabularyBrowser();
                this.refreshIcons();
            },
            renderRows: (target, items) => this.renderQuizVocabularyRows(target, items),
            renderAssignments: (target, items) => this.renderQuizAssignments(target, items)
        });
    }

    getQuizVocabularyItemsForDrilldown(drilldown = {}) {
        return this.vocabularyBrowser.filterItems(this.quizLibraryItems, drilldown);
    }

    renderQuizAssignments(container, vocabItems) {
        if (this.getQuizVocabularyViewMode() === 'rows') {
            this.renderQuizVocabularyRows(container, vocabItems);
            return;
        }
        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid compact-vocab-grid');
        vocabItems
            .slice()
            .sort((itemA, itemB) => this.vocabularyBrowser.comparePlacements(itemA, itemB))
            .forEach(({ vocab, type }) => this.createQuizPickerCard(grid, vocab, type));
        container.appendChild(grid);
    }

    createQuizVocabularyRowList(columns = [], depthClass = this.vocabularyBrowser.getRowLayout(this.quizDrilldown).depthClass) {
        const list = createLibraryRowList(['Name', 'Month', 'Week', 'Type', 'Words']);
        list.classList.add('quiz-vocab-row-list'); return list;
    }

    createQuizVocabularyRow(item, columns, depthClass) {
        const { vocab, type } = item;
        const presentation = this.vocabularyBrowser.getRowPresentation(item);
        const purpose = createElement('span', 'student-vocab-purpose student-vocab-row-type', presentation.purpose || 'Unit');
        const words = createElement('span', 'student-vocab-row-progress', `${presentation.wordCount} ${presentation.wordCount === 1 ? 'word' : 'words'}`);
        words.setAttribute('data-vocab-word-count','');
        const row = createLibraryRow({ primary: formatVocabularyCardTitle(vocab), cells: [presentation.month, presentation.week ? `Week ${presentation.week}` : 'No week', purpose, words], icon: 'file-plus' });
        row.classList.add('student-vocab-unit-row', 'quiz-vocab-row');
        row.setAttribute('aria-label', `Build quiz from ${vocab.name || 'Untitled'}`);
        const countNode = row.querySelector('[data-vocab-word-count]');
        if (!presentation.wordCount && vocab?.path) countNode.dataset.vocabWordCountPath = vocab.path;
        row.addEventListener('click', () => this.openQuizVocabularyItem(vocab, type));
        return this.createQuizMaterialItem(row, vocab, type, true);
    }

    renderQuizVocabularyRows(container, vocabItems = []) {
        if (!vocabItems.length) {
            container.appendChild(createElement('p', 'teacher-empty-state', 'No vocabulary units here yet.'));
            return;
        }

        const { columns, depthClass } = this.vocabularyBrowser.getRowLayout(this.quizDrilldown);
        const list = this.createQuizVocabularyRowList(columns, depthClass);
        vocabItems
            .slice()
            .sort((itemA, itemB) => this.vocabularyBrowser.compareRows(itemA, itemB, this.quizDrilldown))
            .forEach(item => list.appendChild(this.createQuizVocabularyRow(item, columns, depthClass)));
        container.appendChild(list);
        this.hydrateQuizVocabularyRowWordCounts(list);
    }

    hydrateQuizVocabularyRowWordCounts(container) {
        const countNodes = Array.from(container.querySelectorAll('[data-vocab-word-count-path]'));
        const paths = Array.from(new Set(countNodes.map(node => node.dataset.vocabWordCountPath).filter(Boolean)));
        const lifecycleGeneration = this.lifecycleGeneration;
        paths.forEach(async path => {
            const data = await this.loadVocabularyFile(path, { silent: true });
            if (this.destroyed || lifecycleGeneration !== this.lifecycleGeneration) return;
            const count = this.vocabularyBrowser.getWordCount(data || {});
            countNodes
                .filter(node => node.dataset.vocabWordCountPath === path && container.contains(node))
                .forEach(node => {
                    node.textContent = `${count} ${count === 1 ? 'word' : 'words'}`;
                    delete node.dataset.vocabWordCountPath;
                });
        });
    }

    async openQuizVocabularyItem(vocab, type, resolveVocabulary = resolveQuizVocabularyItem) {
        const selectionGeneration = (this.quizVocabularySelectionGeneration || 0) + 1;
        this.quizVocabularySelectionGeneration = selectionGeneration;
        const lifecycleGeneration = this.lifecycleGeneration;
        try {
            const resolvedVocabulary = await resolveVocabulary({ vocab, type });
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || selectionGeneration !== this.quizVocabularySelectionGeneration) return false;

            resolvedVocabulary.subjectSlug = getVocabSubjectSlug(resolvedVocabulary);
            this.commitActiveVocabulary(resolvedVocabulary);
            this.updateQuizHubSummary();
            this.openQuizMaker({ returnTo: 'quizzes' });
            return true;
        } catch (error) {
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || selectionGeneration !== this.quizVocabularySelectionGeneration) return false;
            console.error('Failed to load Quiz vocabulary:', error);
            this.feedback.error('Could not load that vocabulary.');
            return false;
        }
    }

    createQuizPickerCard(container, vocab, type) {
        const presentation = this.vocabularyBrowser.getRowPresentation({ vocab, type });
        const { placement } = this.vocabularyBrowser.getPickerPresentation(vocab, type);
        const card = createVocabularyCard.call({
            sm: { subjects: this.getSubjects?.() || [] },
            vocabularyData: { loadVocabulary: () => this.openQuizVocabularyItem(vocab, type) },
            formatVocabularyCardTitle, formatVocabularyCardDescription,
            formatVocabularyPurpose: () => presentation.purpose || 'Unit',
            getVocabularyPurposeClass: () => `is-${String(vocab.purpose || 'unit').toLowerCase().replace(/[^a-z-]/g, '')}`,
            formatVocabularyScheduleLabel: () => placement || '',
            getVocabularyRequiredProgress: () => ({ percent: 0, completed: 0, total: 0, ariaLabel: 'Quiz vocabulary' })
        }, vocab);
        card.classList.add('teacher-vocab-pick-card');
        card.querySelector('.student-vocab-progress-percent').textContent = '';
        card.querySelector('.student-vocab-required-progress').replaceChildren(createElement('span', '', `${presentation.wordCount} ${presentation.wordCount === 1 ? 'word' : 'words'} · ${{remote:'Repository material',local:'Draft',cloud:'Saved material'}[type] || 'Unit'}`));
        card.setAttribute('aria-label', `Build quiz from ${vocab.name || 'Untitled'}`);
        container.appendChild(this.createQuizMaterialItem(card, vocab, type));
    }

    createQuizMaterialItem(face, vocab, type, isRow = false) {
        const wrapper = createElement('article', `teacher-material-item${isRow ? ' teacher-material-row' : ''}`);
        const actions = createElement('div', 'teacher-material-actions');
        const trigger = createElement('button', 'btn secondary-btn');
        trigger.setAttribute('aria-label', `More actions for ${vocab.name || 'Untitled'}`);
        const menu = createElement('div'); menu.setAttribute('aria-label', `Actions for ${vocab.name || 'Untitled'}`);
        const add = (label, handler) => {
            const button = createElement('button', 'btn secondary-btn', label); button.type = 'button';
            button.setAttribute('role', 'menuitem'); button.addEventListener('click', handler); menu.append(button);
        };
        add('Student preview', async () => {
            const generation = this.lifecycleGeneration;
            const current = () => !this.destroyed && generation === this.lifecycleGeneration;
            const { previewTeacherQuiz } = await import('./teacherStudentPreview.js');
            if (current()) previewTeacherQuiz(this, vocab, type, current);
        });
        add('Build quiz', () => this.openQuizVocabularyItem(vocab, type));
        actions.append(trigger, menu); bindFloatingActionMenu({ trigger, menu });
        wrapper.append(face, actions); return wrapper;
    }
}

export function installTeacherQuizBrowserMethods(TeacherManager) {
    installMethods(TeacherManager, TeacherQuizBrowserMethods);
}
