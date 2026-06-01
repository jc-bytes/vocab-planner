import { $, createElement, escapeHtml, notifications } from './main.js';
import {
    teacherApi as supabaseService,
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from './services/teacherApi.js';
import {
    DEFAULT_SUBJECT_SLUG,
    SCHOOL_CALENDAR_LOCAL_KEY,
    SCHOOL_CALENDAR_SETTINGS_KEY,
    SUBJECTS_LOCAL_KEY,
    calculateVocabularyPlacement,
    getDefaultSchoolCalendar,
    getSubjectBySlug,
    getVocabSubjectSlug,
    loadSubjects,
    normalizeSchoolCalendar,
    normalizeSubject
} from './services/vocabularyApi.js';

const DEV_GAMIFICATION_SETTINGS_KEY = 'dev_gamification_settings';
const DEV_TEACHER_USER = { email: 'teacher@local.dev' };

class TeacherSettingsMethods {
    async loadGamificationSettings() {
        if (this.authDisabled) {
            try {
                const settings = JSON.parse(localStorage.getItem(DEV_GAMIFICATION_SETTINGS_KEY) || '{}');
                const exchangeRateInput = $('#global-exchange-rate');
                const completionBonusInput = $('#global-completion-bonus');
                const progressRewardInput = $('#global-progress-reward');

                if (exchangeRateInput && settings.exchangeRate !== undefined) {
                    exchangeRateInput.value = settings.exchangeRate;
                }
                if (completionBonusInput && settings.completionBonus !== undefined) {
                    completionBonusInput.value = settings.completionBonus;
                }
                if (progressRewardInput && settings.progressReward !== undefined) {
                    progressRewardInput.value = settings.progressReward;
                }
            } catch (error) {
                console.error('Error loading local gamification settings:', error);
            }
            return;
        }

        try {
            const db = supabaseService.getDatabase();
            const settingsRef = doc(db, 'appSettings', 'gamification');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
                const settings = settingsSnap.data();
                const exchangeRateInput = $('#global-exchange-rate');
                const completionBonusInput = $('#global-completion-bonus');
                const progressRewardInput = $('#global-progress-reward');
                
                if (exchangeRateInput && settings.exchangeRate !== undefined) {
                    exchangeRateInput.value = settings.exchangeRate;
                }
                if (completionBonusInput && settings.completionBonus !== undefined) {
                    completionBonusInput.value = settings.completionBonus;
                }
                if (progressRewardInput && settings.progressReward !== undefined) {
                    progressRewardInput.value = settings.progressReward;
                }
            }
        } catch (error) {
            console.error('Error loading gamification settings:', error);
        }
    }

    async loadSubjectSettings() {
        try {
            if (this.authDisabled) {
                const stored = JSON.parse(localStorage.getItem(SUBJECTS_LOCAL_KEY) || '[]');
                this.subjects = stored.length ? stored.map((subject, index) => normalizeSubject(subject, index)) : await loadSubjects();
            } else {
                this.subjects = await loadSubjects(supabaseService);
            }
        } catch (error) {
            console.error('Error loading subjects:', error);
            this.subjects = await loadSubjects();
        }

        this.renderSubjectManager();
        this.updateSubjectSelect();
        this.updateActivitySubjectSelect();
    }

    getSubjects() {
        return (this.subjects && this.subjects.length ? this.subjects : []).map((subject, index) => normalizeSubject(subject, index));
    }

    getActiveSubjects() {
        return this.getSubjects().filter(subject => subject.active !== false);
    }

    getSubjectForVocab(vocab = this.vocabSet) {
        return getSubjectBySlug(this.getSubjects(), getVocabSubjectSlug(vocab));
    }

    getSubjectOptionsHtml(selectedSlug = DEFAULT_SUBJECT_SLUG) {
        const normalizedSelected = getVocabSubjectSlug({ subjectSlug: selectedSlug });
        return this.getSubjects()
            .map(subject => `<option value="${escapeHtml(subject.slug)}"${subject.slug === normalizedSelected ? ' selected' : ''}>${escapeHtml(subject.name)}</option>`)
            .join('');
    }

    updateSubjectSelect() {
        const select = $('#vocab-subject');
        if (!select) return;
        const selected = getVocabSubjectSlug(this.vocabSet);
        select.innerHTML = this.getSubjectOptionsHtml(selected);
        select.value = selected;
    }

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
    }

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
    }

    async saveSubjectSettings() {
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
                const db = supabaseService.getDatabase();
                await Promise.all(subjects.map(subject => setDoc(doc(db, 'subjects', subject.slug), {
                    ...subject,
                    updatedAt: serverTimestamp()
                }, { merge: true })));
            }

            this.invalidateTeacherLibraryCache();
            this.invalidateActivityLibraryCache();
            this.renderSubjectManager();
            this.updateSubjectSelect();
            this.updateActivitySubjectSelect();
            this.loadLibrary();
            this.loadActivityLibrary();
            if (statusEl) statusEl.textContent = 'Subjects saved.';
            notifications.success('Subjects saved.');
        } catch (error) {
            console.error('Error saving subjects:', error);
            if (statusEl) statusEl.textContent = 'Failed to save subjects.';
            notifications.error('Failed to save subjects.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save"></i> Save Subjects';
                this.refreshIcons();
            }
        }
    }

    async loadSchoolCalendarSettings() {
        if (this.authDisabled) {
            try {
                const settings = JSON.parse(localStorage.getItem(SCHOOL_CALENDAR_LOCAL_KEY) || 'null');
                this.schoolCalendar = normalizeSchoolCalendar(settings);
            } catch (error) {
                console.error('Error loading local school calendar:', error);
                this.schoolCalendar = getDefaultSchoolCalendar();
            }
            this.updateSchoolCalendarUI();
            return;
        }

        try {
            const db = supabaseService.getDatabase();
            const settingsRef = doc(db, 'appSettings', SCHOOL_CALENDAR_SETTINGS_KEY);
            const settingsSnap = await getDoc(settingsRef);
            this.schoolCalendar = normalizeSchoolCalendar(settingsSnap.exists() ? settingsSnap.data() : null);
            this.updateSchoolCalendarUI();
        } catch (error) {
            console.error('Error loading school calendar:', error);
            this.schoolCalendar = getDefaultSchoolCalendar();
            this.updateSchoolCalendarUI();
        }
    }

    updateSchoolCalendarUI() {
        const calendar = normalizeSchoolCalendar(this.schoolCalendar);
        const setValue = (id, value) => {
            const input = $(id);
            if (input) input.value = value || '';
        };

        setValue('#school-calendar-year', calendar.schoolYear);
        setValue('#calendar-it-start', calendar.trimesters.IT.startDate);
        setValue('#calendar-it-end', calendar.trimesters.IT.endDate);
        setValue('#calendar-iit-start', calendar.trimesters.IIT.startDate);
        setValue('#calendar-iit-end', calendar.trimesters.IIT.endDate);
        setValue('#calendar-iiit-start', calendar.trimesters.IIIT.startDate);
        setValue('#calendar-iiit-end', calendar.trimesters.IIIT.endDate);
    }

    readSchoolCalendarFromUI() {
        return normalizeSchoolCalendar({
            schoolYear: $('#school-calendar-year')?.value,
            trimesters: {
                IT: {
                    startDate: $('#calendar-it-start')?.value,
                    endDate: $('#calendar-it-end')?.value
                },
                IIT: {
                    startDate: $('#calendar-iit-start')?.value,
                    endDate: $('#calendar-iit-end')?.value
                },
                IIIT: {
                    startDate: $('#calendar-iiit-start')?.value,
                    endDate: $('#calendar-iiit-end')?.value
                }
            }
        });
    }

    validateSchoolCalendar(calendar) {
        const errors = [];
        ['IT', 'IIT', 'IIIT'].forEach(trimester => {
            const range = calendar.trimesters[trimester];
            if (!range.startDate || !range.endDate) {
                errors.push(`${trimester} needs a start and end date.`);
                return;
            }
            if (range.startDate > range.endDate) {
                errors.push(`${trimester} start date must be before its end date.`);
            }
        });
        return errors;
    }

    async saveSchoolCalendarSettings() {
        const calendar = this.readSchoolCalendarFromUI();
        const errors = this.validateSchoolCalendar(calendar);
        const statusEl = $('#school-calendar-save-status');
        const saveBtn = $('#save-school-calendar-btn');

        if (errors.length > 0) {
            if (statusEl) statusEl.textContent = errors[0];
            notifications.error(errors[0]);
            return;
        }

        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i data-lucide="loader-circle"></i> Saving...';
                this.refreshIcons();
            }
            if (statusEl) statusEl.textContent = 'Saving calendar...';

            this.schoolCalendar = calendar;

            if (this.authDisabled) {
                localStorage.setItem(SCHOOL_CALENDAR_LOCAL_KEY, JSON.stringify(calendar));
                const localResult = this.recalculateLocalVocabularyPlacements(calendar);
                this.invalidateTeacherLibraryCache();
                this.updateFormUI();
                const message = `Calendar saved locally. Updated ${localResult.updated} draft vocabularies; ${localResult.skipped} skipped.`;
                if (statusEl) statusEl.textContent = message;
                notifications.success(message);
                return;
            }

            const db = supabaseService.getDatabase();
            const settingsRef = doc(db, 'appSettings', SCHOOL_CALENDAR_SETTINGS_KEY);
            await setDoc(settingsRef, {
                ...calendar,
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser?.email || 'unknown'
            }, { merge: true });

            const result = await this.recalculateCloudVocabularyPlacements(calendar);
            this.invalidateTeacherLibraryCache();
            this.updateFormUI();
            const message = `Calendar saved. Updated ${result.updated} cloud vocabularies; ${result.skipped} skipped.`;
            if (statusEl) statusEl.textContent = message;
            notifications.success(message);
        } catch (error) {
            console.error('Error saving school calendar:', error);
            if (statusEl) statusEl.textContent = 'Failed to save calendar.';
            notifications.error('Failed to save school calendar.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="calendar-check"></i> Save Calendar';
                this.refreshIcons();
            }
        }
    }

    buildPlacementPatch(assignedDate, calendar = this.schoolCalendar) {
        const placement = calculateVocabularyPlacement(assignedDate, calendar);
        if (!placement) {
            return {
                assignedDate: '',
                trimester: '',
                month: '',
                week: ''
            };
        }

        return {
            assignedDate: placement.assignedDate,
            trimester: placement.trimester || '',
            month: placement.month || '',
            week: placement.week || ''
        };
    }

    applyAssignedDatePlacement(vocab = this.vocabSet) {
        if (!vocab?.assignedDate) return;
        Object.assign(vocab, this.buildPlacementPatch(vocab.assignedDate));
    }

    recalculateLocalVocabularyPlacements(calendar) {
        const vocabs = this.getLocalVocabs();
        let updated = 0;
        let skipped = 0;

        const recalculated = vocabs.map(vocab => {
            if (!vocab.assignedDate) {
                skipped += 1;
                return vocab;
            }

            updated += 1;
            return {
                ...vocab,
                ...this.buildPlacementPatch(vocab.assignedDate, calendar)
            };
        });

        localStorage.setItem('teacher_vocab_library', JSON.stringify(recalculated));
        if (this.vocabSet?.assignedDate) {
            this.applyAssignedDatePlacement(this.vocabSet);
        }
        return { updated, skipped };
    }

    async recalculateCloudVocabularyPlacements(calendar) {
        const cloudVocabs = await this.fetchCloudVocabs();
        const db = supabaseService.getDatabase();
        let updated = 0;
        let skipped = 0;

        await Promise.all(cloudVocabs.map(async vocab => {
            if (!vocab.assignedDate) {
                skipped += 1;
                return;
            }

            updated += 1;
            const ref = doc(db, this.VOCAB_COLLECTION, vocab.id);
            await setDoc(ref, {
                ...this.buildPlacementPatch(vocab.assignedDate, calendar),
                updatedAt: serverTimestamp()
            }, { merge: true });
        }));

        if (this.vocabSet?.assignedDate) {
            this.applyAssignedDatePlacement(this.vocabSet);
        }
        return { updated, skipped };
    }
    
    async saveGamificationSettings() {
        const exchangeRate = parseInt($('#global-exchange-rate')?.value) || 10;
        const completionBonus = parseInt($('#global-completion-bonus')?.value) || 50;
        const progressReward = parseInt($('#global-progress-reward')?.value) || 1;
        
        const statusEl = $('#gamification-save-status');
        const saveBtn = $('#save-gamification-btn');
        
        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i data-lucide="loader-circle"></i> Saving...';
                this.refreshIcons();
            }
            if (statusEl) statusEl.textContent = 'Saving settings...';

            if (this.authDisabled) {
                localStorage.setItem(DEV_GAMIFICATION_SETTINGS_KEY, JSON.stringify({
                    exchangeRate,
                    completionBonus,
                    progressReward,
                    updatedAt: new Date().toISOString(),
                    updatedBy: DEV_TEACHER_USER.email
                }));

                if (statusEl) {
                    statusEl.style.color = 'var(--success-color)';
                    statusEl.textContent = 'Settings saved locally.';
                    setTimeout(() => {
                        statusEl.textContent = '';
                        statusEl.style.color = 'var(--text-muted)';
                    }, 3000);
                }

                this.setCloudStatus('Saved locally', 'success');
                notifications.success('Gamification settings saved locally.');
                return;
            }
            
            const db = supabaseService.getDatabase();
            const settingsRef = doc(db, 'appSettings', 'gamification');
            await setDoc(settingsRef, {
                exchangeRate,
                completionBonus,
                progressReward,
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser?.email || 'unknown'
            }, { merge: true });
            
            if (statusEl) {
                statusEl.style.color = 'var(--success-color)';
                statusEl.textContent = 'Settings saved successfully.';
                setTimeout(() => {
                    statusEl.textContent = '';
                    statusEl.style.color = 'var(--text-muted)';
                }, 3000);
            }
            
            notifications.success('Gamification settings saved!');
        } catch (error) {
            console.error('Error saving gamification settings:', error);
            if (statusEl) {
                statusEl.style.color = 'var(--danger-color)';
                statusEl.textContent = 'Failed to save settings. Check permissions.';
            }
            notifications.error('Failed to save settings.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save"></i> Save Settings';
                this.refreshIcons();
            }
        }
    }
}

export function installTeacherSettingsMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherSettingsMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherSettingsMethods.prototype, name)
        );
    }
}
