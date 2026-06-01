import { $, $$, closeModal as closeDialog } from './main.js';

export function initTeacherProgressListeners(manager) {
    $('#view-progress-btn')?.addEventListener('click', () => {
        manager.showProgressView();
    });

    $('#back-to-dashboard-from-progress')?.addEventListener('click', () => {
        manager.showDashboard();
    });

    $('#filter-grade').addEventListener('change', () => manager.applyFilters());
    $('#filter-group').addEventListener('change', () => manager.applyFilters());
    $('#filter-search').addEventListener('input', () => manager.applyFilters());

    $('#close-detail-modal').addEventListener('click', () => {
        closeDialog('#student-detail-modal');
    });

    $('#open-data-management-btn')?.addEventListener('click', () => {
        manager.showDataManagementView();
    });

    $('#back-to-progress-from-data')?.addEventListener('click', () => {
        manager.showProgressView();
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
