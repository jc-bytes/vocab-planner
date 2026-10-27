import { $, $$, closeModal as closeDialog } from './main.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';

const SETTINGS_PAGE = teacherPageRegistry.get('settings');
const STUDENTS_PAGE = teacherPageRegistry.get('students');

export function initTeacherProgressListeners(manager, { controller = new AbortController() } = {}) {
    const on = (element, type, listener) => element?.addEventListener(type, listener, { signal: controller.signal });
    on($('#refresh-student-progress-btn'), 'click', () => {
        manager.fetchStudentProgressPage({ forceRefresh: true }).catch(() => {});
    });
    on($('#filter-grade'), 'change', () => manager.applyFilters());
    on($('#filter-group'), 'change', () => manager.applyFilters());
    on($('#filter-search'), 'input', () => manager.scheduleStudentProgressFilter());
    on($('#student-progress-pagination'), 'click', (event) => {
        const button = event.target.closest('[data-progress-page]');
        if (button && !button.disabled) void manager.changeStudentProgressPage(button.dataset.progressPage).catch(() => {});
    });
    on($('#student-progress-status'), 'click', (event) => {
        if (event.target.closest('[data-progress-retry]')) {
            manager.fetchStudentProgressPage({ forceRefresh: true }).catch(() => {});
        }
    });

    on($('#student-profile-back-btn'), 'click', () => {
        manager.showTeacherSection(STUDENTS_PAGE.id);
    });
    on($('#student-profile-previous-btn'), 'click', () => manager.moveStudentProfile(-1));
    on($('#student-profile-next-btn'), 'click', () => manager.moveStudentProfile(1));
    $$('[data-student-profile-tab]').forEach(button => {
        on(button, 'click', () => manager.setStudentProfileTab(button.dataset.studentProfileTab));
    });

    on($('#open-data-management-btn'), 'click', () => {
        manager.showTeacherSection(SETTINGS_PAGE.id, { tab: 'export' });
    });
    on($('#open-add-student-modal-btn'), 'click', () => {
        manager.showAddStudentModal();
    });
    on($('#import-student-csv-btn'), 'click', () => {
        manager.showStudentCsvPicker();
    });
    on($('#student-csv-input'), 'change', (event) => {
        manager.handleStudentCsvImportFiles(event.target.files);
        event.target.value = '';
    });
    on($('#close-add-student-modal'), 'click', () => {
        closeDialog('#add-student-modal');
    });
    on($('#cancel-add-student-btn'), 'click', () => {
        closeDialog('#add-student-modal');
    });
    on($('#add-student-form'), 'submit', (event) => {
        event.preventDefault();
        if ($('#create-student-account-btn')?.disabled) return;
        void manager.handleAddStudentSubmit(event);
    });

    on($('#coin-adjust-btn'), 'click', () => manager.handleCoinAdjust());
    $$('.quick-coin-btn').forEach(btn => {
        on(btn, 'click', () => {
            const amt = parseInt(btn.dataset.amount, 10) || 0;
            $('#coin-adjust-input').value = amt;
            manager.handleCoinAdjust();
        });
    });

    on($('#select-all-students'), 'change', (e) => {
        manager.handleSelectAll(e.target.checked);
    });
    on($('#select-visible-students-mobile'), 'change', (e) => {
        manager.handleSelectAll(e.target.checked);
    });

    on($('#bulk-add-coins-btn'), 'click', () => {
        manager.handleBulkCoinAdjust();
    });

    on($('#bulk-clear-selection-btn'), 'click', () => {
        manager.clearSelection();
    });

    on($('#reset-student-password-btn'), 'click', () => manager.handlePasswordReset());
    return () => {
        controller.abort();
        globalThis.clearTimeout(manager.studentProgressFilterTimer);
        manager.studentProgressFilterTimer = null;
    };
}
