import { $ } from '../main.js';

export function initTeacherSparksListeners(manager) {
    $('#add-spark-btn')?.addEventListener('click', () => manager.openSparkModal());
    $('#save-spark-draft-btn')?.addEventListener('click', () => manager.saveSparkFromForm('draft'));
    $('#schedule-spark-btn')?.addEventListener('click', () => manager.saveSparkFromForm('scheduled'));
    $('#add-spark-question-btn')?.addEventListener('click', () => manager.addSparkQuestion());
    $('#spark-check-mode-input')?.addEventListener('change', () => manager.updateSparkCheckModeUi());
    $('#spark-question-builder')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-remove-spark-question]');
        if (!button) return;
        manager.removeSparkQuestion(Number(button.dataset.removeSparkQuestion));
    });
    $('#spark-question-builder')?.addEventListener('change', (event) => {
        const select = event.target.closest('[data-spark-question-type]');
        if (!select) return;
        const editor = select.closest('.spark-question-editor');
        const editors = Array.from(document.querySelectorAll('#spark-question-builder .spark-question-editor'));
        manager.changeSparkQuestionType(editors.indexOf(editor), select.value);
    });
    $('#spark-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        manager.saveSparkFromForm($('#spark-status-input')?.value || 'draft');
    });

    $('#spark-library-list')?.addEventListener('click', (event) => {
        const viewButton = event.target.closest('[data-spark-view]');
        if (viewButton) {
            manager.selectSparkView(viewButton.dataset.sparkView);
            return;
        }

        const typeButton = event.target.closest('[data-spark-type-filter]');
        if (typeButton) {
            manager.selectSparkTypeFilter(typeButton.dataset.sparkTypeFilter);
            return;
        }

        const monthButton = event.target.closest('[data-spark-month-shift]');
        if (monthButton) {
            manager.shiftSparkMonth(Number(monthButton.dataset.sparkMonthShift) || 0);
            return;
        }

        const button = event.target.closest('[data-spark-action]');
        if (!button) return;
        const id = button.dataset.sparkId;
        const action = button.dataset.sparkAction;
        const spark = manager.findSparkById(id);
        if (!spark) return;

        if (action === 'edit') {
            manager.openSparkModal(spark);
        } else if (action === 'duplicate') {
            manager.openSparkModal(spark, { duplicate: true });
        } else if (action === 'archive') {
            manager.archiveSpark(id);
        }
    });

    $('#spark-library-list')?.addEventListener('change', (event) => {
        const select = event.target.closest('[data-spark-month-select]');
        if (!select) return;
        manager.selectSparkMonth(select.value);
    });
}

