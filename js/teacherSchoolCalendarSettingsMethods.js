import { $, notifications } from './main.js';
import {
    teacherApi as supabaseService,
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from './services/teacherApi.js';
import {
    SCHOOL_CALENDAR_LOCAL_KEY,
    SCHOOL_CALENDAR_SETTINGS_KEY,
    calculateVocabularyPlacement,
    getDefaultSchoolCalendar,
    normalizeSchoolCalendar
} from './services/vocabularyApi.js';

export const teacherSchoolCalendarSettingsMethods = {
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
    },

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
    },

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
    },

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
    },

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
    },

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
    },

    applyAssignedDatePlacement(vocab = this.vocabSet) {
        if (!vocab?.assignedDate) return;
        Object.assign(vocab, this.buildPlacementPatch(vocab.assignedDate));
    },

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
    },

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
};
