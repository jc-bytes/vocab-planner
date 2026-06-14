import { $, $$, createElement, escapeHtml, notifications } from './main.js';
import { teacherApi as supabaseService } from './services/teacherApi.js';
import { DEFAULT_SUBJECT_SLUG, getSubjectBySlug, normalizeSubjectSlug } from './services/vocabularyApi.js';

const WORD_HUNT_REVIEW_STORAGE_KEY = 'teacher_word_hunt_review_notes';
const WORD_HUNT_REVIEW_VIEW_MODE_KEY = 'teacher_word_hunt_review_view_modes';
const WORD_HUNT_TEXT_RULES = {
    definition: { minChars: 12, minWords: 3 },
    example: { minChars: 18, minWords: 4 }
};

const toDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value.seconds !== undefined) return new Date(value.seconds * 1000);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getStudentName = (student = {}) => {
    const profile = student.studentProfile || {};
    if (profile.firstName && profile.lastName) return `${profile.firstName} ${profile.lastName}`;
    return profile.name || student.email || 'Unknown student';
};

const hasMeaningfulText = (value, rules) => {
    const text = String(value || '').trim();
    if (text.length < rules.minChars) return false;
    return text.split(/\s+/).filter(Boolean).length >= rules.minWords;
};

const getWordQuality = (entry = {}) => ({
    definition: hasMeaningfulText(entry.definition, WORD_HUNT_TEXT_RULES.definition),
    image: Boolean(entry.hasImage || entry.imagePath),
    examples: (
        hasMeaningfulText(entry.exampleOne, WORD_HUNT_TEXT_RULES.example) &&
        hasMeaningfulText(entry.exampleTwo, WORD_HUNT_TEXT_RULES.example)
    )
});

const getUnitLabel = (unitId = '') => String(unitId || 'Vocabulary').replace(/_/g, ' ');

const getWordHuntSubjectSlug = (unitId = '', subjects = []) => {
    const parts = String(unitId || '').split(':');
    if (parts.length <= 1) return DEFAULT_SUBJECT_SLUG;
    const candidate = normalizeSubjectSlug(parts[0], '');
    return subjects.some(subject => subject.slug === candidate) ? candidate : DEFAULT_SUBJECT_SLUG;
};

class TeacherWordHuntReviewMethods {
    async showWordHuntReviewView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.vocabularyMode = 'review';
        this.switchView('teacher-dashboard-view');
        this.setVocabularyWorkflowTab('review', {
            loadReview: false,
            updateRoute: options.updateRoute !== false,
            replace: options.replace === true
        });
        await this.loadWordHuntReview(options);
    }

    initWordHuntReview() {
        if (this.wordHuntReviewInitialized) return;
        this.wordHuntReviewInitialized = true;
        this.wordHuntReviewRows = [];
        this.filteredWordHuntReviewRows = [];
        this.activeWordHuntReviewKey = '';
        this.wordHuntReviewImageUrls = [];
        this.wordHuntReviewDrilldown = { subject: '', grade: '', group: '', unitId: '' };
        this.wordHuntReviewFilters = { status: '', search: '' };
        this.wordHuntReviewViewModes = this.getWordHuntReviewStoredViewModes();

        $('#word-hunt-review-content')?.addEventListener('click', (event) => {
            const action = event.target.closest('[data-word-hunt-review-action]');
            if (!action) return;
            this.handleWordHuntReviewAction(action);
        });

        document.addEventListener('keydown', (event) => this.handleWordHuntReviewKeyboardNavigation(event));
    }

    async loadWordHuntReview(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.initWordHuntReview();

        const content = $('#word-hunt-review-content');
        if (content) content.innerHTML = '<div class="loading-spinner">Loading Word Hunt work...</div>';

        try {
            const students = await this.getStudentProgressData({
                forceRefresh: options.forceRefresh === true,
                showError: false
            });
            this.wordHuntReviewRows = this.buildWordHuntReviewRows(students);
            this.renderWordHuntReviewBrowser({ preserveSelection: true });
        } catch (error) {
            console.error('Failed to load Word Hunt review:', error);
            if (content) content.innerHTML = '<p class="teacher-empty-state">Could not load Word Hunt responses.</p>';
            notifications.error('Could not load Word Hunt review.');
        }
    }

    buildWordHuntReviewRows(students = []) {
        const reviewNotes = this.getWordHuntReviewNotes();
        const subjects = this.getSubjects?.() || [];
        const rows = [];

        students.forEach(student => {
            const profile = student.studentProfile || {};
            const units = student.units || {};

            Object.entries(units).forEach(([unitId, unitData = {}]) => {
                const wordHunt = unitData.wordHunt || {};
                const words = Object.entries(wordHunt)
                    .filter(([word]) => String(word || '').trim())
                    .map(([word, entry]) => {
                        const quality = getWordQuality(entry || {});
                        const complete = quality.definition && quality.image && quality.examples;
                        return {
                            word,
                            entry: entry || {},
                            quality,
                            complete
                        };
                    })
                    .sort((a, b) => a.word.localeCompare(b.word));

                if (words.length === 0) return;

                const completeWords = words.filter(word => word.complete).length;
                const key = `${student.id || student.userId || student.email || 'student'}::${unitId}`;
                const note = reviewNotes[key] || {};
                const lastUpdatedDates = words
                    .map(word => toDate(word.entry.updatedAt || word.entry.imageUpdatedAt))
                    .filter(Boolean);
                const lastUpdated = lastUpdatedDates.length
                    ? new Date(Math.max(...lastUpdatedDates.map(date => date.getTime())))
                    : toDate(unitData.updatedAt || student.updatedAt);

                rows.push({
                    key,
                    studentId: student.id || student.userId || '',
                    student,
                    studentName: getStudentName(student),
                    email: student.email || profile.email || '',
                    subjectSlug: getWordHuntSubjectSlug(unitId, subjects),
                    grade: String(profile.grade || ''),
                    group: String(profile.group || ''),
                    unitId,
                    unitLabel: getUnitLabel(unitId),
                    wordHunt,
                    words,
                    totalWords: words.length,
                    completeWords,
                    missingWords: words.length - completeWords,
                    complete: words.length > 0 && completeWords === words.length,
                    hasSavedWork: words.some(word => (
                        String(word.entry.definition || '').trim() ||
                        String(word.entry.exampleOne || '').trim() ||
                        String(word.entry.exampleTwo || '').trim() ||
                        word.entry.hasImage ||
                        word.entry.imagePath
                    )),
                    score: unitData.scores?.illustration?.score,
                    lastUpdated,
                    note
                });
            });
        });

        return rows.sort((a, b) => {
            const gradeCompare = a.grade.localeCompare(b.grade, undefined, { numeric: true });
            if (gradeCompare) return gradeCompare;
            const groupCompare = a.group.localeCompare(b.group);
            if (groupCompare) return groupCompare;
            return a.studentName.localeCompare(b.studentName);
        });
    }

    getWordHuntReviewNotes() {
        try {
            return JSON.parse(localStorage.getItem(WORD_HUNT_REVIEW_STORAGE_KEY) || '{}');
        } catch (error) {
            console.warn('Could not read Word Hunt review notes:', error);
            return {};
        }
    }

    saveWordHuntReviewNote(key, patch = {}) {
        if (!key) return;
        const notes = this.getWordHuntReviewNotes();
        notes[key] = {
            ...(notes[key] || {}),
            ...patch,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(WORD_HUNT_REVIEW_STORAGE_KEY, JSON.stringify(notes));
        this.wordHuntReviewRows = this.wordHuntReviewRows.map(row => (
            row.key === key ? { ...row, note: notes[key] } : row
        ));
        this.renderWordHuntReviewBrowser({ preserveSelection: true });
    }

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
    }

    getWordHuntReviewStoredViewModes() {
        try {
            const saved = JSON.parse(localStorage.getItem(WORD_HUNT_REVIEW_VIEW_MODE_KEY) || '{}');
            if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
        } catch (error) {
            const legacyMode = localStorage.getItem(WORD_HUNT_REVIEW_VIEW_MODE_KEY);
            if (legacyMode === 'rows') return { subjects: 'rows' };
        }
        return {};
    }

    getWordHuntReviewDepth(drilldown = this.wordHuntReviewDrilldown || {}) {
        if (drilldown.unitId) return 'students';
        if (drilldown.group) return 'vocabularies';
        if (drilldown.grade) return 'groups';
        if (drilldown.subject) return 'grades';
        return 'subjects';
    }

    getWordHuntReviewViewMode(drilldown = this.wordHuntReviewDrilldown || {}) {
        const depth = this.getWordHuntReviewDepth(drilldown);
        return this.wordHuntReviewViewModes?.[depth] === 'rows' ? 'rows' : 'cards';
    }

    setWordHuntReviewViewMode(mode) {
        const depth = this.getWordHuntReviewDepth();
        this.wordHuntReviewViewModes = {
            ...(this.wordHuntReviewViewModes || {}),
            [depth]: mode === 'rows' ? 'rows' : 'cards'
        };
        localStorage.setItem(WORD_HUNT_REVIEW_VIEW_MODE_KEY, JSON.stringify(this.wordHuntReviewViewModes));
    }

    getWordHuntRowsForDrilldown(drilldown = this.wordHuntReviewDrilldown || {}) {
        return this.wordHuntReviewRows.filter(row => {
            if (drilldown.subject && row.subjectSlug !== drilldown.subject) return false;
            if (drilldown.grade === '__other__' && row.grade) return false;
            if (drilldown.grade && drilldown.grade !== '__other__' && row.grade !== drilldown.grade) return false;
            if (drilldown.group === '__other__' && row.group) return false;
            if (drilldown.group && drilldown.group !== '__other__' && row.group !== drilldown.group) return false;
            if (drilldown.unitId && row.unitId !== drilldown.unitId) return false;
            return true;
        });
    }

    summarizeWordHuntRows(rows = []) {
        return {
            rowCount: rows.length,
            reviewed: rows.filter(row => row.note.reviewed).length,
            students: new Set(rows.map(row => row.studentId || row.email || row.studentName)).size,
            vocabularies: new Set(rows.map(row => row.unitId)).size
        };
    }

    getWordHuntSubjectSummaries() {
        const map = new Map();
        this.wordHuntReviewRows.forEach(row => {
            const key = row.subjectSlug || DEFAULT_SUBJECT_SLUG;
            if (!map.has(key)) {
                const subject = getSubjectBySlug(this.getSubjects?.() || [], key);
                map.set(key, { key, label: subject.name, color: subject.color, rows: [] });
            }
            map.get(key).rows.push(row);
        });
        return Array.from(map.values())
            .map(item => ({ ...item, summary: this.summarizeWordHuntRows(item.rows) }))
            .sort((a, b) => {
                const subjectA = getSubjectBySlug(this.getSubjects?.() || [], a.key);
                const subjectB = getSubjectBySlug(this.getSubjects?.() || [], b.key);
                if (subjectA.sortOrder !== subjectB.sortOrder) return subjectA.sortOrder - subjectB.sortOrder;
                return subjectA.name.localeCompare(subjectB.name);
            });
    }

    getWordHuntGradeSummaries() {
        const map = new Map();
        this.getWordHuntRowsForDrilldown({ subject: this.wordHuntReviewDrilldown.subject }).forEach(row => {
            const key = row.grade || '__other__';
            if (!map.has(key)) {
                map.set(key, { key, label: row.grade ? `Grade ${row.grade}` : 'Other', rows: [] });
            }
            map.get(key).rows.push(row);
        });
        return Array.from(map.values())
            .map(item => ({ ...item, summary: this.summarizeWordHuntRows(item.rows) }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }

    getWordHuntGroupSummaries() {
        const map = new Map();
        this.getWordHuntRowsForDrilldown({
            subject: this.wordHuntReviewDrilldown.subject,
            grade: this.wordHuntReviewDrilldown.grade
        }).forEach(row => {
            const key = row.group || '__other__';
            if (!map.has(key)) {
                map.set(key, { key, label: row.group ? `Group ${row.group}` : 'No Group', rows: [] });
            }
            map.get(key).rows.push(row);
        });
        return Array.from(map.values())
            .map(item => ({ ...item, summary: this.summarizeWordHuntRows(item.rows) }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }

    getWordHuntUnitSummaries() {
        const map = new Map();
        this.getWordHuntRowsForDrilldown({
            subject: this.wordHuntReviewDrilldown.subject,
            grade: this.wordHuntReviewDrilldown.grade,
            group: this.wordHuntReviewDrilldown.group
        }).forEach(row => {
            const key = row.unitId || 'vocabulary';
            if (!map.has(key)) {
                map.set(key, { key, label: row.unitLabel, rows: [] });
            }
            map.get(key).rows.push(row);
        });
        return Array.from(map.values())
            .map(item => ({ ...item, summary: this.summarizeWordHuntRows(item.rows) }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    }

    renderWordHuntReviewBrowser(options = {}) {
        const content = $('#word-hunt-review-content');
        if (!content) return;

        if (this.wordHuntReviewRows.length === 0) {
            content.innerHTML = '<p class="teacher-empty-state">No Word Hunt responses have been submitted yet.</p>';
            return;
        }

        const drilldown = this.wordHuntReviewDrilldown || {};
        const toolbar = this.renderWordHuntReviewToolbar();
        const rowsMode = this.getWordHuntReviewViewMode() === 'rows';
        if (!drilldown.subject) {
            content.innerHTML = toolbar + (rowsMode
                ? this.renderWordHuntFlatRows(this.getWordHuntRowsForDrilldown())
                : this.renderWordHuntFolderGrid(this.getWordHuntSubjectSummaries(), 'subject'));
        } else if (!drilldown.grade) {
            content.innerHTML = toolbar + (rowsMode
                ? this.renderWordHuntFlatRows(this.getWordHuntRowsForDrilldown())
                : this.renderWordHuntFolderGrid(this.getWordHuntGradeSummaries(), 'grade'));
        } else if (!drilldown.group) {
            content.innerHTML = toolbar + (rowsMode
                ? this.renderWordHuntFlatRows(this.getWordHuntRowsForDrilldown())
                : this.renderWordHuntFolderGrid(this.getWordHuntGroupSummaries(), 'group'));
        } else if (!drilldown.unitId) {
            content.innerHTML = toolbar + (rowsMode
                ? this.renderWordHuntFlatRows(this.getWordHuntRowsForDrilldown())
                : this.renderWordHuntFolderGrid(this.getWordHuntUnitSummaries(), 'unit'));
        } else {
            content.innerHTML = `${toolbar}${this.renderWordHuntVocabularyWorkspace()}`;
            this.bindWordHuntReviewFilters();
            this.applyWordHuntReviewWorkspaceFilters(options);
        }
        this.refreshIcons();
    }

    renderWordHuntReviewToolbar() {
        const drilldown = this.wordHuntReviewDrilldown || {};
        const parts = [
            '<button type="button" data-word-hunt-review-action="home">Subjects</button>'
        ];
        if (drilldown.subject) {
            const subject = getSubjectBySlug(this.getSubjects?.() || [], drilldown.subject);
            const subjectNode = drilldown.grade || drilldown.group || drilldown.unitId
                ? `<button type="button" data-word-hunt-review-action="subject" data-subject="${escapeHtml(drilldown.subject)}">${escapeHtml(subject.name)}</button>`
                : `<span>${escapeHtml(subject.name)}</span>`;
            parts.push(subjectNode);
        }
        if (drilldown.grade) {
            const gradeLabel = drilldown.grade === '__other__' ? 'Other' : `Grade ${drilldown.grade}`;
            const gradeNode = drilldown.group || drilldown.unitId
                ? `<button type="button" data-word-hunt-review-action="grade" data-subject="${escapeHtml(drilldown.subject || '')}" data-grade="${escapeHtml(drilldown.grade)}">${escapeHtml(gradeLabel)}</button>`
                : `<span>${escapeHtml(gradeLabel)}</span>`;
            parts.push(gradeNode);
        }
        if (drilldown.group) {
            const groupLabel = drilldown.group === '__other__' ? 'No Group' : `Group ${drilldown.group}`;
            const groupNode = drilldown.unitId
                ? `<button type="button" data-word-hunt-review-action="group" data-subject="${escapeHtml(drilldown.subject || '')}" data-grade="${escapeHtml(drilldown.grade)}" data-group="${escapeHtml(drilldown.group)}">${escapeHtml(groupLabel)}</button>`
                : `<span>${escapeHtml(groupLabel)}</span>`;
            parts.push(groupNode);
        }
        if (drilldown.unitId) {
            const unitLabel = this.wordHuntReviewRows.find(row => row.unitId === drilldown.unitId)?.unitLabel || 'Vocabulary';
            parts.push(`<span>${escapeHtml(unitLabel)}</span>`);
        }
        const currentMode = this.getWordHuntReviewViewMode();
        const showViewToggle = !drilldown.unitId;
        return `
            <div class="word-hunt-browser-header">
                <nav class="word-hunt-review-breadcrumb" aria-label="Word Hunt review location">
                    ${parts.join('<span class="word-hunt-review-separator">/</span>')}
                </nav>
                ${showViewToggle ? `
                <div class="vocab-view-toggle word-hunt-view-toggle" aria-label="Word Hunt review view">
                    <button class="vocab-view-toggle-btn ${currentMode === 'cards' ? 'is-active' : ''}" type="button" data-word-hunt-review-action="view-mode" data-view-mode="cards" aria-pressed="${currentMode === 'cards'}" aria-label="Show cards">
                        <i data-lucide="layout-grid"></i><span>Cards</span>
                    </button>
                    <button class="vocab-view-toggle-btn ${currentMode === 'rows' ? 'is-active' : ''}" type="button" data-word-hunt-review-action="view-mode" data-view-mode="rows" aria-pressed="${currentMode === 'rows'}" aria-label="Show rows">
                        <i data-lucide="list"></i><span>Rows</span>
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }

    renderWordHuntFolderGrid(items = [], level = 'grade') {
        if (items.length === 0) {
            return '<p class="teacher-empty-state">No Word Hunt responses found here.</p>';
        }
        return `
            <div class="teacher-library-choice-grid word-hunt-folder-grid">
                ${items.map(item => this.renderWordHuntFolderCard(item, level)).join('')}
            </div>
        `;
    }

    renderWordHuntFolderCard(item, level) {
        const summary = item.summary || {};
        const drilldown = this.wordHuntReviewDrilldown || {};
        const attrs = [
            `data-word-hunt-review-action="${escapeHtml(level)}"`
        ];
        if (level === 'subject') attrs.push(`data-subject="${escapeHtml(item.key)}"`);
        if (level === 'grade') {
            attrs.push(`data-subject="${escapeHtml(drilldown.subject || '')}"`);
            attrs.push(`data-grade="${escapeHtml(item.key)}"`);
        }
        if (level === 'group') {
            attrs.push(`data-subject="${escapeHtml(drilldown.subject || '')}"`);
            attrs.push(`data-grade="${escapeHtml(drilldown.grade || '')}"`);
            attrs.push(`data-group="${escapeHtml(item.key)}"`);
        }
        if (level === 'unit') {
            attrs.push(`data-subject="${escapeHtml(drilldown.subject || '')}"`);
            attrs.push(`data-grade="${escapeHtml(drilldown.grade || '')}"`);
            attrs.push(`data-group="${escapeHtml(drilldown.group || '')}"`);
            attrs.push(`data-unit-id="${escapeHtml(item.key)}"`);
        }
        const primaryCount = level === 'unit'
            ? `${summary.students || 0} ${summary.students === 1 ? 'student' : 'students'}`
            : `${summary.rowCount || 0} ${summary.rowCount === 1 ? 'view' : 'views'}`;
        const secondary = level === 'subject'
            ? `${summary.vocabularies || 0} vocabularies · ${summary.students || 0} students`
            : level === 'grade'
            ? `${summary.vocabularies || 0} vocabularies · ${summary.students || 0} students`
            : `${summary.rowCount || 0} views · ${summary.reviewed || 0} reviewed`;
        return `
            <button class="teacher-library-choice-card word-hunt-folder-card" type="button" ${attrs.join(' ')}>
                <span class="teacher-library-choice-text">
                    <strong>${escapeHtml(item.label)}</strong>
                    <span class="teacher-library-choice-count">${escapeHtml(primaryCount)}</span>
                    <small>${escapeHtml(secondary)}</small>
                </span>
                <i data-lucide="chevron-right"></i>
            </button>
        `;
    }

    renderWordHuntFlatRows(rows = []) {
        const columns = this.getWordHuntReviewRowColumns();
        const sortedRows = rows.slice().sort((a, b) => {
            const subjectA = getSubjectBySlug(this.getSubjects?.() || [], a.subjectSlug);
            const subjectB = getSubjectBySlug(this.getSubjects?.() || [], b.subjectSlug);
            if (subjectA.sortOrder !== subjectB.sortOrder) return subjectA.sortOrder - subjectB.sortOrder;
            const subjectCompare = subjectA.name.localeCompare(subjectB.name);
            if (subjectCompare) return subjectCompare;
            const gradeCompare = a.grade.localeCompare(b.grade, undefined, { numeric: true });
            if (gradeCompare) return gradeCompare;
            const groupCompare = a.group.localeCompare(b.group, undefined, { numeric: true });
            if (groupCompare) return groupCompare;
            const unitCompare = a.unitLabel.localeCompare(b.unitLabel);
            if (unitCompare) return unitCompare;
            return a.studentName.localeCompare(b.studentName);
        });
        if (sortedRows.length === 0) {
            return '<p class="teacher-empty-state">No Word Hunt responses found here.</p>';
        }
        return `
            <div class="student-vocab-row-list word-hunt-review-row-list">
                <div class="student-vocab-row student-vocab-row-header word-hunt-review-row ${this.getWordHuntReviewRowDepthClass()}">
                    <strong>Student</strong>
                    ${columns.map(column => `<span>${escapeHtml(column.label)}</span>`).join('')}
                    <i></i>
                </div>
                ${sortedRows.map(row => this.renderWordHuntFlatRow(row, columns)).join('')}
            </div>
        `;
    }

    getWordHuntReviewRowColumns(drilldown = this.wordHuntReviewDrilldown || {}) {
        return [
            { key: 'subject', label: 'Subject', hidden: Boolean(drilldown.subject) },
            { key: 'grade', label: 'Grade', hidden: Boolean(drilldown.grade) },
            { key: 'group', label: 'Group', hidden: Boolean(drilldown.group) },
            { key: 'vocabulary', label: 'Vocabulary', hidden: Boolean(drilldown.unitId) },
            { key: 'words', label: 'Words', hidden: false },
            { key: 'status', label: 'Status', hidden: false }
        ].filter(column => !column.hidden);
    }

    getWordHuntReviewRowDepthClass(drilldown = this.wordHuntReviewDrilldown || {}) {
        if (drilldown.unitId) return 'word-hunt-review-row-depth-students';
        if (drilldown.group) return 'word-hunt-review-row-depth-group';
        if (drilldown.grade) return 'word-hunt-review-row-depth-grade';
        if (drilldown.subject) return 'word-hunt-review-row-depth-subject';
        return 'word-hunt-review-row-depth-all';
    }

    renderWordHuntFlatRow(row, columns = this.getWordHuntReviewRowColumns()) {
        const status = row.note.reviewed ? 'Reviewed' : 'Open';
        const statusClass = row.note.reviewed ? 'is-reviewed' : 'is-open';
        const subject = getSubjectBySlug(this.getSubjects?.() || [], row.subjectSlug);
        const values = {
            subject: `<span>${escapeHtml(subject.name)}</span>`,
            grade: `<span>${escapeHtml(row.grade ? `Grade ${row.grade}` : 'Other')}</span>`,
            group: `<span>${escapeHtml(row.group || 'No Group')}</span>`,
            vocabulary: `<span>${escapeHtml(row.unitLabel)}</span>`,
            words: `<span>${escapeHtml(`${row.totalWords} words`)}</span>`,
            status: `<span class="word-hunt-status-pill ${statusClass}">${escapeHtml(status)}</span>`
        };
        return `
            <button class="student-vocab-row word-hunt-review-row ${this.getWordHuntReviewRowDepthClass()}" type="button" data-word-hunt-review-action="student" data-word-hunt-key="${escapeHtml(row.key)}">
                <strong>${escapeHtml(row.studentName)}</strong>
                ${columns.map(column => values[column.key]).join('')}
                <i data-lucide="chevron-right"></i>
            </button>
        `;
    }

    renderWordHuntVocabularyWorkspace() {
        return `
            <div class="word-hunt-review-filters">
                <label>
                    <span>Status</span>
                    <select id="word-hunt-status-filter">
                        <option value="">All Statuses</option>
                        <option value="unreviewed"${this.wordHuntReviewFilters.status === 'unreviewed' ? ' selected' : ''}>Unreviewed</option>
                        <option value="reviewed"${this.wordHuntReviewFilters.status === 'reviewed' ? ' selected' : ''}>Reviewed</option>
                    </select>
                </label>
                <label>
                    <span>Search</span>
                    <input type="search" id="word-hunt-search-filter" placeholder="Student" value="${escapeHtml(this.wordHuntReviewFilters.search || '')}">
                </label>
            </div>
            <div class="word-hunt-review-layout">
                <div class="word-hunt-review-roster" id="word-hunt-review-roster"></div>
                <div class="word-hunt-review-detail" id="word-hunt-review-detail">
                    ${this.renderWordHuntEmptyDetail('Select a student to review their Word Hunt table.')}
                </div>
            </div>
        `;
    }

    bindWordHuntReviewFilters() {
        $('#word-hunt-status-filter')?.addEventListener('change', () => {
            this.wordHuntReviewFilters.status = $('#word-hunt-status-filter')?.value || '';
            this.applyWordHuntReviewWorkspaceFilters();
        });
        $('#word-hunt-search-filter')?.addEventListener('input', () => {
            this.wordHuntReviewFilters.search = $('#word-hunt-search-filter')?.value || '';
            this.applyWordHuntReviewWorkspaceFilters();
        });
    }

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
    }

    renderWordHuntReviewRoster() {
        const roster = $('#word-hunt-review-roster');
        if (!roster) return;
        if (this.filteredWordHuntReviewRows.length === 0) {
            roster.innerHTML = '<p class="teacher-empty-state">No students match these filters.</p>';
            return;
        }
        roster.innerHTML = this.filteredWordHuntReviewRows
            .sort((a, b) => a.studentName.localeCompare(b.studentName))
            .map(row => this.renderWordHuntStudentNavRow(row))
            .join('');
        $$('.word-hunt-student-row').forEach(row => {
            row.addEventListener('click', () => this.selectWordHuntReviewRow(row.dataset.wordHuntKey));
        });
    }

    getSortedWordHuntReviewRowsForNavigation() {
        return (this.filteredWordHuntReviewRows || [])
            .slice()
            .sort((a, b) => a.studentName.localeCompare(b.studentName));
    }

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
    }

    renderWordHuntStudentNavRow(row) {
        const statusClass = row.note.reviewed ? 'is-reviewed' : 'is-open';
        const dateLabel = row.lastUpdated ? row.lastUpdated.toLocaleDateString() : '-';
        return `
            <button class="word-hunt-student-row ${statusClass}" type="button" data-word-hunt-key="${escapeHtml(row.key)}" aria-label="Review ${escapeHtml(row.studentName)} ${escapeHtml(row.unitLabel)}">
                <span class="word-hunt-roster-main">
                    <strong>${escapeHtml(row.studentName)}</strong>
                    <span>${escapeHtml(dateLabel)}</span>
                </span>
            </button>
        `;
    }

    renderWordHuntReviewDetail(row) {
        const status = row.note.reviewed
            ? `Reviewed ${row.note.reviewedAt ? new Date(row.note.reviewedAt).toLocaleDateString() : ''}`.trim()
            : 'Ready to review';
        const score = row.score !== undefined ? `${row.score}%` : '-';
        const noteText = row.note.feedback || '';

        return `
            <div class="word-hunt-detail-header">
                <div>
                    <h4>${escapeHtml(row.studentName)}</h4>
                    <p>Grade ${escapeHtml(row.grade || '-')} ${escapeHtml(row.group || '')} · ${escapeHtml(row.unitLabel)}</p>
                </div>
                <div class="word-hunt-detail-score">
                    <strong>${escapeHtml(score)}</strong>
                    <span>Word Hunt score</span>
                </div>
            </div>

            <div class="word-hunt-detail-summary">
                <span>${row.totalWords} words</span>
                <span>${escapeHtml(status)}</span>
                <span>${row.lastUpdated ? `Updated ${escapeHtml(row.lastUpdated.toLocaleDateString())}` : 'No update date'}</span>
            </div>

            <div class="word-hunt-export-table-wrap">
                <table class="word-hunt-export-table">
                    <thead>
                        <tr>
                            <th>Word</th>
                            <th>Evidence</th>
                            <th>Image</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${row.words.map(wordRow => this.renderWordHuntTableRow(wordRow)).join('')}
                    </tbody>
                </table>
            </div>

            <div class="word-hunt-teacher-note">
                <label for="word-hunt-review-note">Teacher Notes</label>
                <textarea id="word-hunt-review-note" rows="3" placeholder="Private local note for this review">${escapeHtml(noteText)}</textarea>
                <div class="word-hunt-note-actions">
                    <button id="save-word-hunt-review-note-btn" class="btn secondary-btn" type="button">
                        <i data-lucide="save"></i>
                        Save Note
                    </button>
                    <button id="toggle-word-hunt-reviewed-btn" class="btn primary-btn" type="button">
                        <i data-lucide="${row.note.reviewed ? 'rotate-ccw' : 'check'}"></i>
                        ${row.note.reviewed ? 'Mark Unreviewed' : 'Mark Reviewed'}
                    </button>
                </div>
                <p>Notes and reviewed status are saved on this teacher device until a backend review RPC is added.</p>
            </div>
        `;
    }

    renderWordHuntTableRow(wordRow) {
        const { word, entry } = wordRow;
        const examples = [
            entry.exampleOne ? `1. ${entry.exampleOne}` : '',
            entry.exampleTwo ? `2. ${entry.exampleTwo}` : ''
        ].filter(Boolean).join('\n');
        return `
            <tr>
                <th scope="row">${escapeHtml(word)}</th>
                <td>
                    <div class="word-hunt-table-evidence">
                        <span>Definition</span>
                        <p>${escapeHtml(entry.definition || 'No definition saved')}</p>
                        <span>Examples</span>
                        <p>${escapeHtml(examples || 'No examples saved')}</p>
                    </div>
                </td>
                <td>
                    <div class="word-hunt-image-review is-table" data-word-hunt-image="${escapeHtml(word)}">
                        <span>${entry.imagePath ? 'Loading image...' : 'No image saved'}</span>
                    </div>
                </td>
            </tr>
        `;
    }

    /*
     * Kept for older callers/tests that may still ask for cards directly.
     * The active review surface now uses renderWordHuntTableRow().
     */
    renderWordHuntWordCard(wordRow) {
        const { word, entry } = wordRow;
        const examples = [
            entry.exampleOne ? `1. ${entry.exampleOne}` : '',
            entry.exampleTwo ? `2. ${entry.exampleTwo}` : ''
        ].filter(Boolean).join('\n');
        const hasSavedWork = Boolean(
            String(entry.definition || '').trim() ||
            String(entry.exampleOne || '').trim() ||
            String(entry.exampleTwo || '').trim() ||
            entry.hasImage ||
            entry.imagePath
        );

            return `
            <article class="word-hunt-word-card ${hasSavedWork ? 'is-complete' : 'is-open'}">
                <div class="word-hunt-word-title">
                    <strong>${escapeHtml(word)}</strong>
                    <span class="word-hunt-status-pill ${hasSavedWork ? 'is-complete' : 'is-open'}">${hasSavedWork ? 'Saved' : 'Blank'}</span>
                </div>
                <div class="word-hunt-word-grid">
                    <div class="word-hunt-evidence-block">
                        <span>Definition</span>
                        <p>${escapeHtml(entry.definition || 'No definition saved')}</p>
                    </div>
                    <div class="word-hunt-evidence-block">
                        <span>Examples</span>
                        <p>${escapeHtml(examples || 'No examples saved')}</p>
                    </div>
                    <div class="word-hunt-image-review" data-word-hunt-image="${escapeHtml(word)}">
                        <span>${entry.imagePath ? 'Loading image...' : 'No image saved'}</span>
                    </div>
                </div>
            </article>
        `;
    }

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
    }

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
    }

    async loadWordHuntReviewImages(row) {
        if (this.authDisabled) return;

        await Promise.all(row.words.map(async wordRow => {
            const path = wordRow.entry.imagePath;
            if (!path) return;
            const target = $(`.word-hunt-image-review[data-word-hunt-image="${CSS.escape(wordRow.word)}"]`);
            if (!target) return;

            try {
                const blob = await supabaseService.downloadWordHuntImage(path);
                if (!blob) {
                    target.innerHTML = '<span>Image unavailable</span>';
                    return;
                }
                const url = URL.createObjectURL(blob);
                this.wordHuntReviewImageUrls.push(url);
                target.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(wordRow.word)} Word Hunt image">`;
            } catch (error) {
                console.warn('Could not load Word Hunt image:', path, error);
                target.innerHTML = '<span>Image unavailable</span>';
            }
        }));
    }

    revokeWordHuntReviewImageUrls() {
        (this.wordHuntReviewImageUrls || []).forEach(url => URL.revokeObjectURL(url));
        this.wordHuntReviewImageUrls = [];
    }

    renderWordHuntEmptyDetail(message) {
        return `
            <div class="word-hunt-review-empty">
                <strong>Select a Word Hunt submission</strong>
                <span>${escapeHtml(message)}</span>
            </div>
        `;
    }
}

export function installTeacherWordHuntReviewMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherWordHuntReviewMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherWordHuntReviewMethods.prototype, name)
        );
    }
}
