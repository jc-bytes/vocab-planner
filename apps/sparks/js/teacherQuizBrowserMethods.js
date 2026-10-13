import { $, createElement, escapeHtml } from './main.js';
import { getVocabSubjectSlug } from './services/vocabularyApi.js';
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

        this.vocabularyBrowser.renderHierarchy({
            container,
            breadcrumbHost: container,
            items: this.quizLibraryItems || [],
            drilldown: this.quizDrilldown,
            getViewMode: drilldown => this.getQuizVocabularyViewMode(drilldown),
            resetDrilldown: () => this.resetQuizDrilldown(),
            filterItems: drilldown => this.getQuizVocabularyItemsForDrilldown(drilldown),
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
        const list = createElement('div', 'student-vocab-row-list teacher-vocab-row-list quiz-vocab-row-list');
        const header = createElement('div', 'student-vocab-row student-vocab-row-header teacher-vocab-row quiz-vocab-row');
        header.classList.add(depthClass);
        header.setAttribute('aria-hidden', 'true');
        header.appendChild(createElement('strong', null, 'Name'));
        columns.forEach(column => header.appendChild(createElement('span', null, column.label)));
        header.appendChild(createElement('span', null, 'Action'));
        header.appendChild(createElement('i'));
        list.appendChild(header);
        return list;
    }

    createQuizVocabularyRow(item, columns, depthClass) {
        const { vocab, type } = item;
        const presentation = this.vocabularyBrowser.getRowPresentation(item);
        const row = createElement('button', 'student-vocab-row teacher-vocab-row quiz-vocab-row');
        row.classList.add(depthClass);
        row.type = 'button';
        const values = {
            grade: `<span>${escapeHtml(presentation.grades || 'Other')}</span>`,
            trimester: `<span>${escapeHtml(presentation.trimester)}</span>`,
            month: `<span>${escapeHtml(presentation.month)}</span>`,
            week: `<span>${escapeHtml(presentation.week ? `Week ${presentation.week}` : 'No week')}</span>`,
            purpose: `<span class="student-vocab-purpose">${escapeHtml(presentation.purpose || 'Unit')}</span>`,
            words: `<span data-vocab-word-count>${escapeHtml(presentation.wordCount ? `${presentation.wordCount}` : '...')}</span>`
        };
        row.innerHTML = `<strong>${escapeHtml(vocab.name || 'Untitled')}</strong>${columns.map(column => values[column.key]).join('')}<span class="quiz-vocab-row-action"><i data-lucide="file-plus"></i> Build</span><i data-lucide="chevron-right"></i>`;
        const countNode = row.querySelector('[data-vocab-word-count]');
        if (!presentation.wordCount && vocab?.path) countNode.dataset.vocabWordCountPath = vocab.path;
        row.addEventListener('click', () => this.openQuizVocabularyItem(vocab, type));
        return row;
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
                    node.textContent = String(count);
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
        const card = createElement('button', 'teacher-vocab-pick-card');
        card.type = 'button';
        const { badge, grades, subject, placement } = this.vocabularyBrowser.getPickerPresentation(vocab, type);
        card.innerHTML = `
            <span class="teacher-source-badge">${badge}</span>
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
