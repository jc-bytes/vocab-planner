import { $ } from '../main.js';
import {
    createVocabularyBreadcrumbButton,
    createVocabularyChoiceCard,
    renderTeacherVocabularyHierarchy,
    renderVocabularyBreadcrumb,
    renderVocabularyGradePicker,
    renderVocabularyMonthPicker,
    renderVocabularySubjectPicker,
    renderVocabularyTrimesterPicker
} from './teacherVocabularyHierarchy.js';

function createLibraryBrowserOptions(owner, container) {
    return {
        container,
        breadcrumbHost: $('#teacher-vocab-breadcrumb') || container,
        items: owner.libraryItems || [],
        drilldown: owner.libraryDrilldown,
        getViewMode: drilldown => owner.getTeacherVocabularyViewMode(drilldown),
        resetDrilldown: () => owner.resetLibraryDrilldown(),
        filterItems: drilldown => owner.getTeacherVocabularyItemsForDrilldown(drilldown),
        onNavigate: drilldown => {
            owner.libraryDrilldown = drilldown;
            owner.updateVocabularyRoute();
            owner.renderLibraryBrowser();
            owner.refreshIcons();
        },
        renderRows: (target, items) => owner.renderTeacherVocabularyRows(target, items),
        renderAssignments: (target, items) => {
            if (owner.getTeacherVocabularyViewMode() === 'rows') {
                owner.renderTeacherVocabularyRows(target, items);
                return;
            }
            const grid = document.createElement('div');
            grid.className = 'vocab-grid trimester-vocab-grid teacher-assignment-grid';
            items
                .sort((itemA, itemB) => owner.compareVocabPlacement(itemA.vocab, itemB.vocab))
                .forEach(({ vocab, type }) => owner.createLibraryCard(grid, vocab, type));
            target.appendChild(grid);
        }
    };
}

export const teacherVocabularyBrowserViewMethods = {
    renderLibraryBrowser(container = $('#library-list')) {
        if (!container) return;
        this.renderTeacherVocabularyViewControls();
        container.classList.remove('vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';
        renderTeacherVocabularyHierarchy(this, createLibraryBrowserOptions(this, container));
    },

    renderLibraryBreadcrumb(container, subject = null, grade = null, trimester = null, month = null) {
        renderVocabularyBreadcrumb(this, {
            ...createLibraryBrowserOptions(this, container),
            drilldown: { subject, grade, trimester, month }
        });
    },

    createLibraryBreadcrumbButton(label, onClick) {
        return createVocabularyBreadcrumbButton(label, onClick);
    },

    renderSubjectPicker(container, subjectGroups) {
        renderVocabularySubjectPicker(this, createLibraryBrowserOptions(this, container), subjectGroups);
    },

    renderGradePicker(container, selectedSubject, gradeGroups) {
        renderVocabularyGradePicker(this, createLibraryBrowserOptions(this, container), selectedSubject, gradeGroups);
    },

    renderTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups) {
        renderVocabularyTrimesterPicker(
            this,
            createLibraryBrowserOptions(this, container),
            selectedSubject,
            selectedGrade,
            trimesterGroups
        );
    },

    renderMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups) {
        renderVocabularyMonthPicker(
            this,
            createLibraryBrowserOptions(this, container),
            selectedSubject,
            selectedGrade,
            selectedTrimester,
            monthGroups
        );
    },

    renderAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, vocabItems) {
        const options = createLibraryBrowserOptions(this, container);
        renderVocabularyBreadcrumb(this, {
            ...options,
            drilldown: {
                subject: selectedSubject,
                grade: selectedGrade,
                trimester: selectedTrimester,
                month: selectedMonth
            }
        });
        options.renderAssignments(container, vocabItems);
    },

    createLibraryChoiceCard(options) {
        return createVocabularyChoiceCard(options);
    }
};
