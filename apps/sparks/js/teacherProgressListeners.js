import { $, $$, closeModal as closeDialog } from './main.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';

const SETTINGS_PAGE = teacherPageRegistry.get('settings');
const STUDENTS_PAGE = teacherPageRegistry.get('students');

export function initTeacherProgressListeners(manager) {
    $('#refresh-student-progress-btn')?.addEventListener('click', () => {
        manager.fetchStudentProgressPage({ forceRefresh: true }).catch(() => {});
    });
    $('#filter-grade')?.addEventListener('change', () => manager.applyFilters());
    $('#filter-group')?.addEventListener('change', () => manager.applyFilters());
    $('#filter-search')?.addEventListener('input', () => manager.scheduleStudentProgressFilter());
    $('#student-progress-pagination')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-progress-page]');
        if (button && !button.disabled) manager.changeStudentProgressPage(button.dataset.progressPage);
    });
    $('#student-progress-status')?.addEventListener('click', (event) => {
        if (event.target.closest('[data-progress-retry]')) {
            manager.fetchStudentProgressPage({ forceRefresh: true }).catch(() => {});
        }
    });

    $('#student-profile-back-btn')?.addEventListener('click', () => {
        manager.showTeacherSection(STUDENTS_PAGE.id);
    });
    $('#student-profile-previous-btn')?.addEventListener('click', () => manager.moveStudentProfile(-1));
    $('#student-profile-next-btn')?.addEventListener('click', () => manager.moveStudentProfile(1));
    $$('[data-student-profile-tab]').forEach(button => {
        button.addEventListener('click', () => manager.setStudentProfileTab(button.dataset.studentProfileTab));
    });

    $('#open-data-management-btn')?.addEventListener('click', () => {
        manager.showTeacherSection(SETTINGS_PAGE.id, { tab: 'export' });
    });
    $('#open-add-student-modal-btn')?.addEventListener('click', () => {
        manager.showAddStudentModal();
    });
    $('#import-student-csv-btn')?.addEventListener('click', () => {
        manager.showStudentCsvPicker();
    });
    $('#student-csv-input')?.addEventListener('change', (event) => {
        manager.handleStudentCsvImportFiles(event.target.files);
        event.target.value = '';
    });
    $('#close-add-student-modal')?.addEventListener('click', () => {
        closeDialog('#add-student-modal');
    });
    $('#cancel-add-student-btn')?.addEventListener('click', () => {
        closeDialog('#add-student-modal');
    });
    $('#add-student-form')?.addEventListener('submit', (event) => {
        manager.handleAddStudentSubmit(event);
    });

    $('#coin-adjust-btn').addEventListener('click', () => manager.handleCoinAdjust());
    $$('.quick-coin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amt = parseInt(btn.dataset.amount, 10) || 0;
            $('#coin-adjust-input').value = amt;
            manager.handleCoinAdjust();
        });
    });

    $('#select-all-students')?.addEventListener('change', (e) => {
        manager.handleSelectAll(e.target.checked);
    });
    $('#select-visible-students-mobile')?.addEventListener('change', (e) => {
        manager.handleSelectAll(e.target.checked);
    });

    $('#bulk-add-coins-btn')?.addEventListener('click', () => {
        manager.handleBulkCoinAdjust();
    });

    $('#bulk-clear-selection-btn')?.addEventListener('click', () => {
        manager.clearSelection();
    });

    $('#reset-student-password-btn')?.addEventListener('click', () => manager.handlePasswordReset());
}
