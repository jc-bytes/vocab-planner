import { escapeHtml } from '../main.js';
import { getSubjectBySlug } from '../services/vocabularyApi.js';

export const teacherWordHuntReviewViewMethods = {
renderWordHuntReviewBrowser(options = {}) {
        const content = this.query('#word-hunt-review-content');
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
    },

renderWordHuntReviewToolbar() {
        const drilldown = this.wordHuntReviewDrilldown || {};
        const parts = [
            '<button type="button" data-word-hunt-review-action="home">Subjects</button>'
        ];
        if (drilldown.subject) {
            const subject = getSubjectBySlug(this.getSubjects(), drilldown.subject);
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
    },

renderWordHuntFolderGrid(items = [], level = 'grade') {
        if (items.length === 0) {
            return '<p class="teacher-empty-state">No Word Hunt responses found here.</p>';
        }
        return `
            <div class="teacher-library-choice-grid word-hunt-folder-grid">
                ${items.map(item => this.renderWordHuntFolderCard(item, level)).join('')}
            </div>
        `;
    },

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
    },

renderWordHuntFlatRows(rows = []) {
        const columns = this.getWordHuntReviewRowColumns();
        const sortedRows = rows.slice().sort((a, b) => {
            const subjectA = getSubjectBySlug(this.getSubjects(), a.subjectSlug);
            const subjectB = getSubjectBySlug(this.getSubjects(), b.subjectSlug);
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
    },

getWordHuntReviewRowColumns(drilldown = this.wordHuntReviewDrilldown || {}) {
        return [
            { key: 'subject', label: 'Subject', hidden: Boolean(drilldown.subject) },
            { key: 'grade', label: 'Grade', hidden: Boolean(drilldown.grade) },
            { key: 'group', label: 'Group', hidden: Boolean(drilldown.group) },
            { key: 'vocabulary', label: 'Vocabulary', hidden: Boolean(drilldown.unitId) },
            { key: 'words', label: 'Words', hidden: false },
            { key: 'status', label: 'Status', hidden: false }
        ].filter(column => !column.hidden);
    },

getWordHuntReviewRowDepthClass(drilldown = this.wordHuntReviewDrilldown || {}) {
        if (drilldown.unitId) return 'word-hunt-review-row-depth-students';
        if (drilldown.group) return 'word-hunt-review-row-depth-group';
        if (drilldown.grade) return 'word-hunt-review-row-depth-grade';
        if (drilldown.subject) return 'word-hunt-review-row-depth-subject';
        return 'word-hunt-review-row-depth-all';
    },

renderWordHuntFlatRow(row, columns = this.getWordHuntReviewRowColumns()) {
        const status = row.note.reviewed ? 'Reviewed' : 'Open';
        const statusClass = row.note.reviewed ? 'is-reviewed' : 'is-open';
        const subject = getSubjectBySlug(this.getSubjects(), row.subjectSlug);
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
    },

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
    },

renderWordHuntReviewRoster() {
        const roster = this.query('#word-hunt-review-roster');
        if (!roster) return;
        if (this.filteredWordHuntReviewRows.length === 0) {
            roster.innerHTML = '<p class="teacher-empty-state">No students match these filters.</p>';
            return;
        }
        roster.innerHTML = this.filteredWordHuntReviewRows
            .sort((a, b) => a.studentName.localeCompare(b.studentName))
            .map(row => this.renderWordHuntStudentNavRow(row))
            .join('');
        this.queryAll('.word-hunt-student-row').forEach(row => {
            row.addEventListener('click', () => this.selectWordHuntReviewRow(row.dataset.wordHuntKey));
        });
    },

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
    },

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
    },

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
    },

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
    },

renderWordHuntEmptyDetail(message) {
        return `
            <div class="word-hunt-review-empty">
                <strong>Select a Word Hunt submission</strong>
                <span>${escapeHtml(message)}</span>
            </div>
        `;
    },
};
