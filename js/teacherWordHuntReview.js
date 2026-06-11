import { $, $$, createElement, escapeHtml, notifications } from './main.js';
import { teacherApi as supabaseService } from './services/teacherApi.js';

const WORD_HUNT_REVIEW_STORAGE_KEY = 'teacher_word_hunt_review_notes';
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

class TeacherWordHuntReviewMethods {
    initWordHuntReview() {
        if (this.wordHuntReviewInitialized) return;
        this.wordHuntReviewInitialized = true;
        this.wordHuntReviewRows = [];
        this.filteredWordHuntReviewRows = [];
        this.activeWordHuntReviewKey = '';
        this.wordHuntReviewImageUrls = [];

        $('#refresh-word-hunt-review-btn')?.addEventListener('click', () => this.loadWordHuntReview({ forceRefresh: true }));
        [
            '#word-hunt-grade-filter',
            '#word-hunt-section-filter',
            '#word-hunt-status-filter',
            '#word-hunt-unit-filter',
            '#word-hunt-search-filter'
        ].forEach(selector => {
            $(selector)?.addEventListener('input', () => this.applyWordHuntReviewFilters());
            $(selector)?.addEventListener('change', () => this.applyWordHuntReviewFilters());
        });
    }

    async loadWordHuntReview(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.initWordHuntReview();

        const roster = $('#word-hunt-review-roster');
        const detail = $('#word-hunt-review-detail');
        if (roster) roster.innerHTML = '<div class="loading-spinner">Loading Word Hunt work...</div>';
        if (detail) detail.innerHTML = this.renderWordHuntEmptyDetail('Loading student vocabulary responses...');

        try {
            const students = await this.getStudentProgressData({
                forceRefresh: options.forceRefresh === true,
                showError: false
            });
            this.wordHuntReviewRows = this.buildWordHuntReviewRows(students);
            this.populateWordHuntReviewFilters();
            this.applyWordHuntReviewFilters({ preserveSelection: true });
        } catch (error) {
            console.error('Failed to load Word Hunt review:', error);
            if (roster) roster.innerHTML = '<p class="teacher-empty-state">Could not load Word Hunt responses.</p>';
            if (detail) detail.innerHTML = this.renderWordHuntEmptyDetail('Could not load Word Hunt responses.');
            notifications.error('Could not load Word Hunt review.');
        }
    }

    buildWordHuntReviewRows(students = []) {
        const reviewNotes = this.getWordHuntReviewNotes();
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
        this.applyWordHuntReviewFilters({ preserveSelection: true });
    }

    populateWordHuntReviewFilters() {
        const gradeSelect = $('#word-hunt-grade-filter');
        const sectionSelect = $('#word-hunt-section-filter');
        const unitSelect = $('#word-hunt-unit-filter');
        const selected = {
            grade: gradeSelect?.value || '',
            group: sectionSelect?.value || '',
            unit: unitSelect?.value || ''
        };

        const grades = Array.from(new Set(this.wordHuntReviewRows.map(row => row.grade).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const groups = Array.from(new Set(this.wordHuntReviewRows
            .filter(row => !selected.grade || row.grade === selected.grade)
            .map(row => row.group)
            .filter(Boolean)))
            .sort();
        const units = Array.from(new Map(this.wordHuntReviewRows
            .map(row => [row.unitId, row.unitLabel]))
            .entries())
            .sort((a, b) => a[1].localeCompare(b[1]));

        this.setWordHuntFilterOptions(gradeSelect, 'All Grades', grades.map(value => [value, `Grade ${value}`]), selected.grade);
        this.setWordHuntFilterOptions(sectionSelect, 'All Sections', groups.map(value => [value, value]), selected.group);
        this.setWordHuntFilterOptions(unitSelect, 'All Vocabularies', units, selected.unit);
    }

    setWordHuntFilterOptions(select, emptyLabel, options, selectedValue) {
        if (!select) return;
        select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>${options.map(([value, label]) => `
            <option value="${escapeHtml(value)}"${value === selectedValue ? ' selected' : ''}>${escapeHtml(label)}</option>
        `).join('')}`;
        if (selectedValue && !options.some(([value]) => value === selectedValue)) {
            select.value = '';
        }
    }

    applyWordHuntReviewFilters(options = {}) {
        this.populateWordHuntReviewFilters();
        const grade = $('#word-hunt-grade-filter')?.value || '';
        const group = $('#word-hunt-section-filter')?.value || '';
        const status = $('#word-hunt-status-filter')?.value || '';
        const unit = $('#word-hunt-unit-filter')?.value || '';
        const search = ($('#word-hunt-search-filter')?.value || '').trim().toLowerCase();

        this.filteredWordHuntReviewRows = this.wordHuntReviewRows.filter(row => {
            if (grade && row.grade !== grade) return false;
            if (group && row.group !== group) return false;
            if (unit && row.unitId !== unit) return false;
            if (status === 'complete' && !row.complete) return false;
            if (status === 'needs-review' && (row.complete || row.note.reviewed)) return false;
            if (status === 'reviewed' && !row.note.reviewed) return false;
            if (search) {
                const haystack = `${row.studentName} ${row.email} ${row.unitLabel}`.toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });

        this.renderWordHuntReviewStats();
        this.renderWordHuntReviewRoster();

        const hasActiveRow = this.filteredWordHuntReviewRows.some(row => row.key === this.activeWordHuntReviewKey);
        if (options.preserveSelection && hasActiveRow) {
            this.selectWordHuntReviewRow(this.activeWordHuntReviewKey);
        } else {
            const firstRow = this.filteredWordHuntReviewRows[0];
            if (firstRow) {
                this.selectWordHuntReviewRow(firstRow.key);
            } else {
                $('#word-hunt-review-detail') && ($('#word-hunt-review-detail').innerHTML = this.renderWordHuntEmptyDetail('No Word Hunt responses match these filters.'));
            }
        }
        this.refreshIcons();
    }

    renderWordHuntReviewStats() {
        const rows = this.wordHuntReviewRows;
        const reviewed = rows.filter(row => row.note.reviewed).length;
        const complete = rows.filter(row => row.complete).length;
        const needsReview = rows.filter(row => !row.complete && !row.note.reviewed).length;

        $('#word-hunt-total-count') && ($('#word-hunt-total-count').textContent = rows.length);
        $('#word-hunt-complete-count') && ($('#word-hunt-complete-count').textContent = complete);
        $('#word-hunt-needs-review-count') && ($('#word-hunt-needs-review-count').textContent = needsReview);
        $('#word-hunt-reviewed-count') && ($('#word-hunt-reviewed-count').textContent = reviewed);
    }

    renderWordHuntReviewRoster() {
        const roster = $('#word-hunt-review-roster');
        if (!roster) return;

        if (this.filteredWordHuntReviewRows.length === 0) {
            roster.innerHTML = '<p class="teacher-empty-state">No Word Hunt responses match these filters.</p>';
            return;
        }

        roster.innerHTML = this.filteredWordHuntReviewRows.map(row => {
            const status = row.note.reviewed
                ? 'Reviewed'
                : (row.complete ? 'Complete' : 'Needs Review');
            const statusClass = row.note.reviewed
                ? 'is-reviewed'
                : (row.complete ? 'is-complete' : 'needs-review');
            const dateLabel = row.lastUpdated ? row.lastUpdated.toLocaleDateString() : '-';
            return `
                <button class="word-hunt-roster-row ${statusClass}" type="button" data-word-hunt-key="${escapeHtml(row.key)}" aria-label="Review ${escapeHtml(row.studentName)} ${escapeHtml(row.unitLabel)}">
                    <span class="word-hunt-roster-main">
                        <strong>${escapeHtml(row.studentName)}</strong>
                        <small>Grade ${escapeHtml(row.grade || '-')} ${escapeHtml(row.group || '')} · ${escapeHtml(row.unitLabel)}</small>
                    </span>
                    <span class="word-hunt-roster-meta">
                        <span>${row.completeWords}/${row.totalWords} words</span>
                        <span>${escapeHtml(dateLabel)}</span>
                    </span>
                    <span class="word-hunt-status-pill ${statusClass}">${escapeHtml(status)}</span>
                </button>
            `;
        }).join('');

        $$('.word-hunt-roster-row').forEach(row => {
            row.addEventListener('click', () => this.selectWordHuntReviewRow(row.dataset.wordHuntKey));
        });
    }

    async selectWordHuntReviewRow(key) {
        const row = this.wordHuntReviewRows.find(item => item.key === key);
        const detail = $('#word-hunt-review-detail');
        if (!row || !detail) return;

        this.activeWordHuntReviewKey = key;
        $$('.word-hunt-roster-row').forEach(button => {
            button.classList.toggle('is-selected', button.dataset.wordHuntKey === key);
        });

        this.revokeWordHuntReviewImageUrls();
        detail.innerHTML = this.renderWordHuntReviewDetail(row);
        this.bindWordHuntReviewDetail(row);
        this.refreshIcons();
        await this.loadWordHuntReviewImages(row);
    }

    renderWordHuntReviewDetail(row) {
        const status = row.note.reviewed
            ? `Reviewed ${row.note.reviewedAt ? new Date(row.note.reviewedAt).toLocaleDateString() : ''}`.trim()
            : (row.complete ? 'Ready to review' : 'Needs teacher attention');
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
                <span>${row.completeWords}/${row.totalWords} complete</span>
                <span>${row.missingWords} need revision</span>
                <span>${escapeHtml(status)}</span>
            </div>

            <div class="word-hunt-word-list">
                ${row.words.map(wordRow => this.renderWordHuntWordCard(wordRow)).join('')}
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

    renderWordHuntWordCard(wordRow) {
        const { word, entry, quality, complete } = wordRow;
        const examples = [
            entry.exampleOne ? `1. ${entry.exampleOne}` : '',
            entry.exampleTwo ? `2. ${entry.exampleTwo}` : ''
        ].filter(Boolean).join('\n');
        const missing = [
            quality.definition ? '' : 'Definition',
            quality.examples ? '' : 'Examples',
            quality.image ? '' : 'Image'
        ].filter(Boolean);

        return `
            <article class="word-hunt-word-card ${complete ? 'is-complete' : 'needs-review'}">
                <div class="word-hunt-word-title">
                    <strong>${escapeHtml(word)}</strong>
                    <span class="word-hunt-status-pill ${complete ? 'is-complete' : 'needs-review'}">${complete ? 'Complete' : `Check ${escapeHtml(missing.join(', '))}`}</span>
                </div>
                <div class="word-hunt-word-grid">
                    <div class="word-hunt-evidence-block">
                        <span>Definition</span>
                        <p>${escapeHtml(entry.definition || 'Missing definition')}</p>
                    </div>
                    <div class="word-hunt-evidence-block">
                        <span>Examples</span>
                        <p>${escapeHtml(examples || 'Missing two examples')}</p>
                    </div>
                    <div class="word-hunt-image-review" data-word-hunt-image="${escapeHtml(word)}">
                        <span>${entry.imagePath ? 'Loading image...' : 'No image saved'}</span>
                    </div>
                </div>
            </article>
        `;
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
