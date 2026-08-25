import { $, createElement, escapeHtml, notifications } from './main.js';
import { supabaseService } from './supabaseService.js';
import { subjectsRepository } from './services/subjectsRepository.js';
import {
    DEFAULT_SUBJECT_SLUG,
    SUBJECTS_LOCAL_KEY,
    getSubjectBySlug,
    getVocabSubjectSlug,
    loadSubjects,
    normalizeSubject
} from './services/vocabularyApi.js';
import { createTeacherSettingsOperationGuard } from './teacherSettingsSession.js';

export const teacherSubjectSettingsMethods = {
    async loadSubjectSettings(options = {}) {
        const isCurrent = createTeacherSettingsOperationGuard(this, options);
        if (!isCurrent()) return false;
        if (this.subjectSettingsLoaded && options.forceRefresh !== true) {
            if (!isCurrent()) return false;
            this.renderSubjectManager();
            this.updateSubjectSelect();
            return true;
        }

        let loadError = null;
        try {
            let subjects;
            if (this.authDisabled) {
                const stored = JSON.parse(localStorage.getItem(SUBJECTS_LOCAL_KEY) || '[]');
                subjects = stored.length
                    ? stored.map((subject, index) => normalizeSubject(subject, index))
                    : await loadSubjects();
            } else {
                subjects = await loadSubjects(supabaseService);
            }
            if (!isCurrent()) return false;
            this.subjects = subjects;
            this.subjectSettingsLoaded = true;
        } catch (error) {
            if (!isCurrent()) return false;
            console.error('Error loading subjects:', error);
            loadError = error;
            const subjects = await loadSubjects();
            if (!isCurrent()) return false;
            this.subjectSettingsLoaded = false;
            this.subjects = subjects;
        }

        if (!isCurrent()) return false;
        this.renderSubjectManager();
        this.updateSubjectSelect();
        if (loadError && options.surfaceErrors) throw loadError;
        return true;
    },

    getSubjects() {
        return (this.subjects && this.subjects.length ? this.subjects : []).map((subject, index) => normalizeSubject(subject, index));
    },

    getActiveSubjects() {
        return this.getSubjects().filter(subject => subject.active !== false);
    },

    getSubjectForVocab(vocab = this.vocabSet) {
        return getSubjectBySlug(this.getSubjects(), getVocabSubjectSlug(vocab));
    },

    getSubjectOptionsHtml(selectedSlug = DEFAULT_SUBJECT_SLUG) {
        const normalizedSelected = getVocabSubjectSlug({ subjectSlug: selectedSlug });
        return this.getSubjects()
            .map(subject => `<option value="${escapeHtml(subject.slug)}"${subject.slug === normalizedSelected ? ' selected' : ''}>${escapeHtml(subject.name)}</option>`)
            .join('');
    },

    updateSubjectSelect() {
        const select = $('#vocab-subject');
        if (!select) return;
        const selected = getVocabSubjectSlug(this.vocabSet);
        select.innerHTML = this.getSubjectOptionsHtml(selected);
        select.value = selected;
    },

    renderSubjectManager() {
        const container = $('#subjects-manager-list');
        if (!container) return;

        const subjects = this.getSubjects();
        this.subjects = subjects;
        container.innerHTML = '';

        subjects.forEach((subject, index) => {
            const row = createElement('div', 'subject-manager-row');
            row.innerHTML = `
                <span class="subject-color-dot" style="background:${escapeHtml(subject.color)};"></span>
                <input type="text" class="subject-name-input" value="${escapeHtml(subject.name)}" aria-label="Subject name">
                <input type="color" class="subject-color-input" value="${escapeHtml(subject.color)}" aria-label="Subject color">
                <input type="number" class="subject-order-input" value="${escapeHtml(subject.sortOrder)}" aria-label="Subject order">
                <label class="subject-active-toggle">
                    <input type="checkbox" class="subject-active-input"${subject.active ? ' checked' : ''}>
                    Active
                </label>
                <code>${escapeHtml(subject.slug)}</code>
            `;

            row.querySelector('.subject-name-input')?.addEventListener('input', event => {
                this.subjects[index].name = event.target.value;
                this.updateSubjectSelect();
            });
            row.querySelector('.subject-color-input')?.addEventListener('input', event => {
                this.subjects[index].color = event.target.value;
                row.querySelector('.subject-color-dot').style.background = event.target.value;
            });
            row.querySelector('.subject-order-input')?.addEventListener('input', event => {
                this.subjects[index].sortOrder = Number(event.target.value) || ((index + 1) * 10);
            });
            row.querySelector('.subject-active-input')?.addEventListener('change', event => {
                this.subjects[index].active = event.target.checked;
            });

            container.appendChild(row);
        });
    },

    addSubjectFromForm() {
        const input = $('#new-subject-name');
        const colorInput = $('#new-subject-color');
        const name = String(input?.value || '').trim();
        if (!name) {
            notifications.warning('Enter a subject name.');
            return;
        }

        const subject = normalizeSubject({
            name,
            slug: name,
            color: colorInput?.value || '#2563eb',
            sortOrder: Math.max(0, ...this.getSubjects().map(item => Number(item.sortOrder) || 0)) + 10,
            active: true
        });

        if (this.getSubjects().some(item => item.slug === subject.slug)) {
            notifications.warning('A subject with that name already exists.');
            return;
        }

        this.subjects = [...this.getSubjects(), subject];
        if (input) input.value = '';
        this.renderSubjectManager();
        this.updateSubjectSelect();
    },

    async saveSubjectSettings(options = {}) {
        const isCurrent = createTeacherSettingsOperationGuard(this, options);
        if (!isCurrent()) return false;
        const statusEl = $('#subjects-save-status');
        const saveBtn = $('#save-subjects-btn');
        const subjects = this.getSubjects()
            .map((subject, index) => normalizeSubject({
                ...subject,
                sortOrder: Number(subject.sortOrder) || ((index + 1) * 10)
            }, index));

        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i data-lucide="loader-circle"></i> Saving...';
                this.refreshIcons();
            }
            if (statusEl) statusEl.textContent = 'Saving subjects...';

            this.subjects = subjects;
            if (this.authDisabled) {
                localStorage.setItem(SUBJECTS_LOCAL_KEY, JSON.stringify(subjects));
            } else {
                await subjectsRepository.saveAll(subjects.map(subject => ({
                    ...subject,
                    updatedAt: new Date().toISOString()
                })));
                if (!isCurrent()) return false;
            }

            if (!isCurrent()) return false;
            this.subjectSettingsLoaded = true;

            this.invalidateTeacherLibraryCache();
            this.renderSubjectManager();
            this.updateSubjectSelect();
            if (statusEl) statusEl.textContent = 'Subjects saved.';
            notifications.success('Subjects saved.');
            return true;
        } catch (error) {
            if (!isCurrent()) return false;
            console.error('Error saving subjects:', error);
            if (statusEl) statusEl.textContent = 'Failed to save subjects.';
            notifications.error('Failed to save subjects.');
            return false;
        } finally {
            if (isCurrent() && saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save"></i> Save Subjects';
                this.refreshIcons();
            }
        }
    }
};
