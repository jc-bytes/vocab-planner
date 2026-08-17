import { $, $$, notifications } from '../main.js';
import { DEFAULT_SUBJECT_SLUG } from '../services/vocabularyApi.js';

export const teacherWordHuntReviewInteractionMethods = {
handleWordHuntReviewAction(action) {
        const nextLevel = action.dataset.wordHuntReviewAction;
        if (nextLevel === 'home') {
            this.wordHuntReviewDrilldown = { subject: '', grade: '', group: '', unitId: '' };
        } else if (nextLevel === 'subject') {
            this.wordHuntReviewDrilldown = { subject: action.dataset.subject || '', grade: '', group: '', unitId: '' };
        } else if (nextLevel === 'grade') {
            this.wordHuntReviewDrilldown = {
                subject: action.dataset.subject || this.wordHuntReviewDrilldown.subject || '',
                grade: action.dataset.grade || '',
                group: '',
                unitId: ''
            };
        } else if (nextLevel === 'group') {
            this.wordHuntReviewDrilldown = {
                subject: action.dataset.subject || this.wordHuntReviewDrilldown.subject || '',
                grade: action.dataset.grade || this.wordHuntReviewDrilldown.grade || '',
                group: action.dataset.group || '',
                unitId: ''
            };
        } else if (nextLevel === 'unit') {
            this.wordHuntReviewDrilldown = {
                subject: action.dataset.subject || this.wordHuntReviewDrilldown.subject || '',
                grade: action.dataset.grade || this.wordHuntReviewDrilldown.grade || '',
                group: action.dataset.group || this.wordHuntReviewDrilldown.group || '',
                unitId: action.dataset.unitId || ''
            };
        } else if (nextLevel === 'student') {
            const row = this.wordHuntReviewRows.find(item => item.key === action.dataset.wordHuntKey);
            if (row) {
                this.wordHuntReviewDrilldown = {
                    subject: row.subjectSlug || DEFAULT_SUBJECT_SLUG,
                    grade: row.grade || '__other__',
                    group: row.group || '__other__',
                    unitId: row.unitId || ''
                };
                this.activeWordHuntReviewKey = row.key;
                this.wordHuntReviewFilters = { status: '', search: '' };
                this.revokeWordHuntReviewImageUrls();
                this.renderWordHuntReviewBrowser({ preserveSelection: true });
                return;
            }
        } else if (nextLevel === 'view-mode') {
            this.setWordHuntReviewViewMode(action.dataset.viewMode);
            this.renderWordHuntReviewBrowser({ preserveSelection: true });
            return;
        }
        this.activeWordHuntReviewKey = '';
        this.wordHuntReviewFilters = { status: '', search: '' };
        this.revokeWordHuntReviewImageUrls();
        this.renderWordHuntReviewBrowser();
    },

bindWordHuntReviewFilters() {
        $('#word-hunt-status-filter')?.addEventListener('change', () => {
            this.wordHuntReviewFilters.status = $('#word-hunt-status-filter')?.value || '';
            this.applyWordHuntReviewWorkspaceFilters();
        });
        $('#word-hunt-search-filter')?.addEventListener('input', () => {
            this.wordHuntReviewFilters.search = $('#word-hunt-search-filter')?.value || '';
            this.applyWordHuntReviewWorkspaceFilters();
        });
    },

applyWordHuntReviewWorkspaceFilters(options = {}) {
        const status = this.wordHuntReviewFilters.status || '';
        const search = String(this.wordHuntReviewFilters.search || '').trim().toLowerCase();
        this.filteredWordHuntReviewRows = this.getWordHuntRowsForDrilldown().filter(row => {
            if (status === 'unreviewed' && row.note.reviewed) return false;
            if (status === 'reviewed' && !row.note.reviewed) return false;
            if (search) {
                const haystack = `${row.studentName} ${row.email}`.toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });
        this.renderWordHuntReviewRoster();

        const hasActiveRow = this.filteredWordHuntReviewRows.some(row => row.key === this.activeWordHuntReviewKey);
        if (options.preserveSelection && hasActiveRow) {
            this.selectWordHuntReviewRow(this.activeWordHuntReviewKey);
        } else {
            this.selectWordHuntReviewRow(this.filteredWordHuntReviewRows[0]?.key || '');
        }
    },

getSortedWordHuntReviewRowsForNavigation() {
        return (this.filteredWordHuntReviewRows || [])
            .slice()
            .sort((a, b) => a.studentName.localeCompare(b.studentName));
    },

handleWordHuntReviewKeyboardNavigation(event) {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (this.vocabularyMode !== 'review') return;

        const reviewPanel = $('#vocabulary-review-panel');
        if (!reviewPanel || reviewPanel.classList.contains('hidden')) return;

        const target = event.target;
        const isTypingTarget = target?.closest?.('input, textarea, select, [contenteditable="true"]');
        if (isTypingTarget) return;

        const rows = this.getSortedWordHuntReviewRowsForNavigation();
        if (rows.length < 2) return;

        const currentIndex = rows.findIndex(row => row.key === this.activeWordHuntReviewKey);
        const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = event.key === 'ArrowRight'
            ? (fallbackIndex + 1) % rows.length
            : (fallbackIndex - 1 + rows.length) % rows.length;

        event.preventDefault();
        this.selectWordHuntReviewRow(rows[nextIndex].key);
    },

async selectWordHuntReviewRow(key) {
        const row = this.wordHuntReviewRows.find(item => item.key === key);
        const detail = $('#word-hunt-review-detail');
        if (!detail) return;
        if (!row) {
            this.activeWordHuntReviewKey = '';
            this.revokeWordHuntReviewImageUrls();
            detail.innerHTML = this.renderWordHuntEmptyDetail('No student Word Hunt work matches this view.');
            $$('.word-hunt-student-row').forEach(button => button.classList.remove('is-selected'));
            return;
        }

        this.activeWordHuntReviewKey = key;
        $$('.word-hunt-student-row').forEach(button => {
            button.classList.toggle('is-selected', button.dataset.wordHuntKey === key);
        });
        $(`.word-hunt-student-row[data-word-hunt-key="${CSS.escape(key)}"]`)?.scrollIntoView({
            block: 'nearest'
        });

        this.revokeWordHuntReviewImageUrls();
        detail.innerHTML = this.renderWordHuntReviewDetail(row);
        this.bindWordHuntReviewDetail(row);
        this.refreshIcons();
        await this.loadWordHuntReviewImages(row);
    },

bindWordHuntReviewDetail(row) {
        $('#save-word-hunt-review-note-btn')?.addEventListener('click', () => {
            this.saveWordHuntReviewNote(row.key, {
                feedback: $('#word-hunt-review-note')?.value || ''
            });
            notifications.success('Word Hunt note saved on this device.');
        });

        $('#toggle-word-hunt-reviewed-btn')?.addEventListener('click', () => {
            this.saveWordHuntReviewNote(row.key, {
                reviewed: !row.note.reviewed,
                reviewedAt: !row.note.reviewed ? new Date().toISOString() : ''
            });
            notifications.success(!row.note.reviewed ? 'Marked reviewed.' : 'Marked unreviewed.');
        });
    },
};

