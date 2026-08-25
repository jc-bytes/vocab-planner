export function bindTeacherSparksListeners(context) {
    const disposers = [];
    const listen = (element, type, handler) => {
        if (!element) return;
        element.addEventListener(type, handler);
        disposers.push(() => element.removeEventListener(type, handler));
    };

    context.queryAll('#spark-modal .close-modal').forEach(button => {
        listen(button, 'click', () => context.closeDialog('#spark-modal'));
    });
    listen(context.query('#add-spark-btn'), 'click', () => context.openSparkModal());
    listen(context.query('#save-spark-draft-btn'), 'click', () => context.saveSparkFromForm('draft'));
    listen(context.query('#schedule-spark-btn'), 'click', () => context.saveSparkFromForm('scheduled'));
    listen(context.query('#add-spark-question-btn'), 'click', () => context.addSparkQuestion());
    listen(context.query('#spark-check-mode-input'), 'change', () => context.updateSparkCheckModeUi());
    listen(context.query('#spark-question-builder'), 'click', (event) => {
        const button = event.target.closest('[data-remove-spark-question]');
        if (!button) return;
        context.removeSparkQuestion(Number(button.dataset.removeSparkQuestion));
    });
    listen(context.query('#spark-question-builder'), 'change', (event) => {
        const select = event.target.closest('[data-spark-question-type]');
        if (!select) return;
        const editor = select.closest('.spark-question-editor');
        const editors = context.queryAll('#spark-question-builder .spark-question-editor');
        context.changeSparkQuestionType(editors.indexOf(editor), select.value);
    });
    listen(context.query('#spark-form'), 'submit', (event) => {
        event.preventDefault();
        context.saveSparkFromForm(context.query('#spark-status-input')?.value || 'draft');
    });

    listen(context.query('#spark-library-list'), 'click', (event) => {
        const viewButton = event.target.closest('[data-spark-view]');
        if (viewButton) {
            context.selectSparkView(viewButton.dataset.sparkView);
            return;
        }

        const typeButton = event.target.closest('[data-spark-type-filter]');
        if (typeButton) {
            context.selectSparkTypeFilter(typeButton.dataset.sparkTypeFilter);
            return;
        }

        const monthButton = event.target.closest('[data-spark-month-shift]');
        if (monthButton) {
            context.shiftSparkMonth(Number(monthButton.dataset.sparkMonthShift) || 0);
            return;
        }

        const button = event.target.closest('[data-spark-action]');
        if (!button) return;
        const id = button.dataset.sparkId;
        const action = button.dataset.sparkAction;
        const spark = context.findSparkById(id);
        if (!spark) return;

        if (action === 'edit') {
            context.openSparkModal(spark);
        } else if (action === 'duplicate') {
            context.openSparkModal(spark, { duplicate: true });
        } else if (action === 'archive') {
            context.archiveSpark(id);
        }
    });

    listen(context.query('#spark-library-list'), 'change', (event) => {
        const select = event.target.closest('[data-spark-month-select]');
        if (!select) return;
        context.selectSparkMonth(select.value);
    });

    return () => disposers.splice(0).forEach(dispose => dispose());
}
