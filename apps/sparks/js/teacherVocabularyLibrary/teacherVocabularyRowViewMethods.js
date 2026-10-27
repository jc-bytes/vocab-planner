import { createLibraryRowList, createLibraryRow } from '../learningLibraryView.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { createElement } from '../main.js';
import { loadVocabularyFile } from '../services/vocabularyApi.js';
import { formatVocabularyCardTitle } from '../vocabularyCardView.js';

export const teacherVocabularyRowViewMethods = {
createTeacherVocabularyRowList(columns = []) {
        return createLibraryRowList(['Name', 'Month', 'Week', 'Type', 'Words']);
    },
createTeacherVocabularyRow({ vocab, type }, columns = this.getTeacherVocabularyRowColumns()) {
        const month = this.getTeacherMonthLabel(this.getTeacherMonthKey(vocab));
        const week = vocab?.week || this.inferTeacherWeek(vocab) || '';
        const purpose = createElement('span', 'student-vocab-purpose student-vocab-row-type', this.getTeacherVocabularyPurpose(vocab, type) || 'Unit');
        const wordCount = this.getTeacherVocabularyWordCount(vocab);
        const count = createElement('span', 'student-vocab-row-progress');
        count.setAttribute('data-vocab-word-count', '');
        count.textContent = `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`;
        const row = createLibraryRow({primary: formatVocabularyCardTitle(vocab), cells: [month, week ? `Week ${week}` : 'No week', purpose, count], icon: 'arrow-right'});
        row.classList.add('student-vocab-unit-row');
        const countNode = row.querySelector('[data-vocab-word-count]');
        if (!wordCount && vocab?.path) {
            countNode.dataset.vocabWordCountPath = vocab.path;
        }
        const mount = createElement('div', 'teacher-material-mount');
        const current = this.createTeacherVocabularyOperationGuard();
        void requestWithTimeout(() => Promise.all([import('../teacherMaterialItem.js'), import('../teacherUnitActions.js')]), { timeoutMs: 10000, label: 'Loading vocabulary row' }).then(([{ createTeacherMaterialItem }, { createTeacherUnitActions }]) => {
            if (!current() || !mount.isConnected) return;
            const actions = createTeacherUnitActions(this, vocab, type);
            const wrapper = createTeacherMaterialItem({ face: row, title: vocab.name || 'Untitled', ...actions });
            wrapper.classList.add('teacher-material-row');
            row.addEventListener('click', actions.onPreview);
            mount.replaceWith(wrapper);
            this.refreshIcons(wrapper);
            this.hydrateTeacherVocabularyRowWordCounts(wrapper);
        }).catch(error => { if (current()) { console.warn('Could not load vocabulary row', error); this.showMaterialRetry(mount); } });
        return mount;
    },
hydrateTeacherVocabularyRowWordCounts(container) {
        const current = this.createTeacherVocabularyOperationGuard();
        const countNodes = Array.from(container.querySelectorAll('[data-vocab-word-count-path]'));
        const paths = Array.from(new Set(countNodes.map(node => node.dataset.vocabWordCountPath).filter(Boolean)));
        paths.forEach(async path => {
            try {
            const data = await loadVocabularyFile(path, { silent: true });
            if (!current() || !container.isConnected) return;
            const count = this.getTeacherVocabularyWordCount(data || {});
            countNodes
                .filter(node => node.isConnected && node.dataset.vocabWordCountPath === path)
                .forEach(node => {
                    node.textContent = `${count} ${count === 1 ? 'word' : 'words'}`;
                    delete node.dataset.vocabWordCountPath;
                });
            } catch (error) { if (current()) console.warn('Could not load vocabulary word count', error); }
        });
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
