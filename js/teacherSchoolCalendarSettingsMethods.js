import { $, notifications } from './main.js';
import { settingsRepository } from './services/settingsRepository.js';
import { vocabularyRepository } from './services/vocabularyRepository.js';
import {
    SCHOOL_CALENDAR_LOCAL_KEY,
    SCHOOL_CALENDAR_SETTINGS_KEY,
    SCHOOL_WEEKDAYS,
    calculateCalendarEndDateFromWeekCount,
    calculateCalendarWeekCount,
    calculateCalendarWeekRange,
    calculateVocabularyPlacement,
    getDefaultSchoolCalendar,
    normalizeSchoolCalendar
} from './services/vocabularyApi.js';

const SCHOOL_CALENDAR_TRIMESTERS = [
    { key: 'IT', slug: 'it' },
    { key: 'IIT', slug: 'iit' },
    { key: 'IIIT', slug: 'iiit' }
];

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
            const settings = await settingsRepository.get(SCHOOL_CALENDAR_SETTINGS_KEY);
            this.schoolCalendar = normalizeSchoolCalendar(settings);
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
        setValue('#calendar-it-weeks', calendar.trimesters.IT.weekCount);
        setValue('#calendar-it-end', calendar.trimesters.IT.endDate);
        setValue('#calendar-iit-start', calendar.trimesters.IIT.startDate);
        setValue('#calendar-iit-weeks', calendar.trimesters.IIT.weekCount);
        setValue('#calendar-iit-end', calendar.trimesters.IIT.endDate);
        setValue('#calendar-iiit-start', calendar.trimesters.IIIT.startDate);
        setValue('#calendar-iiit-weeks', calendar.trimesters.IIIT.weekCount);
        setValue('#calendar-iiit-end', calendar.trimesters.IIIT.endDate);
        this.renderClassScheduleRows(calendar.classSchedules);
        this.updateSchoolCalendarRangePreviews();
    },

    readSchoolCalendarFromUI() {
        return normalizeSchoolCalendar({
            schoolYear: $('#school-calendar-year')?.value,
            classSchedules: this.readClassSchedulesFromUI(),
            trimesters: {
                IT: this.readSchoolCalendarTrimesterFromUI('it'),
                IIT: this.readSchoolCalendarTrimesterFromUI('iit'),
                IIIT: this.readSchoolCalendarTrimesterFromUI('iiit')
            }
        });
    },

    readClassSchedulesFromUI() {
        return Array.from(document.querySelectorAll('#class-schedule-list .class-schedule-row')).map(row => ({
            grade: row.querySelector('[data-class-schedule-grade]')?.value || '',
            section: row.querySelector('[data-class-schedule-section]')?.value || '',
            weekdays: Array.from(row.querySelectorAll('[data-class-schedule-day]:checked'))
                .map(input => Number(input.value))
        }));
    },

    validateClassScheduleRows() {
        const schedules = this.readClassSchedulesFromUI();
        const seen = new Set();
        for (const schedule of schedules) {
            const grade = String(schedule.grade || '').match(/\d+/)?.[0] || '';
            const section = String(schedule.section || '').trim().toUpperCase();
            if (!grade || !section) return 'Every class schedule needs a grade and section.';
            if (!schedule.weekdays.length) return `Grade ${grade}${section} needs at least one class day.`;
            const key = `${grade}:${section}`;
            if (seen.has(key)) return `Grade ${grade}${section} is listed more than once.`;
            seen.add(key);
        }
        return '';
    },

    renderClassScheduleRows(schedules = []) {
        const list = $('#class-schedule-list');
        if (!list) return;
        list.innerHTML = '';
        schedules.forEach(schedule => this.addClassScheduleRow(schedule));
        list.classList.toggle('is-empty', schedules.length === 0);
    },

    addClassScheduleRow(schedule = {}) {
        const list = $('#class-schedule-list');
        if (!list) return;

        const row = document.createElement('div');
        row.className = 'class-schedule-row';
        const selectedDays = new Set((schedule.weekdays || []).map(Number));
        row.innerHTML = `
            <label class="class-schedule-field">
                <span>Grade</span>
                <select data-class-schedule-grade aria-label="Class grade">
                    ${['6', '7', '8', '9'].map(grade => `<option value="${grade}"${String(schedule.grade || '') === grade ? ' selected' : ''}>${grade}</option>`).join('')}
                </select>
            </label>
            <label class="class-schedule-field">
                <span>Section</span>
                <input data-class-schedule-section type="text" maxlength="2" value="${String(schedule.section || '').replace(/[^a-z0-9]/gi, '').toUpperCase()}" placeholder="A" aria-label="Class section">
            </label>
            <fieldset class="class-schedule-days">
                <legend>Meeting days</legend>
                ${SCHOOL_WEEKDAYS.map(day => `
                    <label title="${day.key}">
                        <input data-class-schedule-day type="checkbox" value="${day.value}"${selectedDays.has(day.value) ? ' checked' : ''}>
                        <span>${day.shortLabel}</span>
                    </label>
                `).join('')}
            </fieldset>
            <button class="btn text-btn class-schedule-remove" type="button" data-remove-class-schedule aria-label="Remove class schedule">
                <i data-lucide="trash-2"></i><span>Remove</span>
            </button>
        `;
        list.appendChild(row);
        list.classList.remove('is-empty');
        this.refreshIcons();
        return row;
    },

    readSchoolCalendarTrimesterFromUI(slug) {
        const startDate = $(`#calendar-${slug}-start`)?.value || '';
        const weekCount = Number.parseInt($(`#calendar-${slug}-weeks`)?.value || '', 10) || '';
        const endDate = $(`#calendar-${slug}-end`)?.value
            || calculateCalendarEndDateFromWeekCount(startDate, weekCount)
            || '';

        return { startDate, endDate, weekCount };
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
            if (!Number.isInteger(Number(range.weekCount)) || Number(range.weekCount) <= 0) {
                errors.push(`${trimester} needs a positive number of weeks.`);
            }
        });
        return errors;
    },

    bindSchoolCalendarInputs() {
        SCHOOL_CALENDAR_TRIMESTERS.forEach(({ slug }) => {
            ['start', 'weeks', 'end'].forEach(field => {
                const input = $(`#calendar-${slug}-${field}`);
                if (!input || input.dataset.calendarBound === 'true') return;
                input.dataset.calendarBound = 'true';
                input.addEventListener('input', () => {
                    this.handleSchoolCalendarInput(slug, field);
                });
            });
        });

        const addButton = $('#add-class-schedule-btn');
        if (addButton && addButton.dataset.calendarBound !== 'true') {
            addButton.dataset.calendarBound = 'true';
            addButton.addEventListener('click', () => this.addClassScheduleRow({ grade: '6', section: '', weekdays: [] }));
        }

        const scheduleList = $('#class-schedule-list');
        if (scheduleList && scheduleList.dataset.calendarBound !== 'true') {
            scheduleList.dataset.calendarBound = 'true';
            scheduleList.addEventListener('click', event => {
                const removeButton = event.target.closest('[data-remove-class-schedule]');
                if (!removeButton) return;
                removeButton.closest('.class-schedule-row')?.remove();
                scheduleList.classList.toggle('is-empty', scheduleList.children.length === 0);
            });
        }
    },

    handleSchoolCalendarInput(slug, field) {
        if (field === 'end') {
            this.updateSchoolCalendarWeekCountFromDates(slug);
        } else {
            this.updateSchoolCalendarEndFromWeeks(slug);
        }
        this.updateSchoolCalendarRangePreview(slug);
    },

    updateSchoolCalendarEndFromWeeks(slug) {
        const startInput = $(`#calendar-${slug}-start`);
        const weeksInput = $(`#calendar-${slug}-weeks`);
        const endInput = $(`#calendar-${slug}-end`);
        const endDate = calculateCalendarEndDateFromWeekCount(startInput?.value, weeksInput?.value);
        if (endInput && endDate) endInput.value = endDate;
    },

    updateSchoolCalendarWeekCountFromDates(slug) {
        const startInput = $(`#calendar-${slug}-start`);
        const weeksInput = $(`#calendar-${slug}-weeks`);
        const endInput = $(`#calendar-${slug}-end`);
        const weekCount = calculateCalendarWeekCount(startInput?.value, endInput?.value);
        if (weeksInput && weekCount) weeksInput.value = weekCount;
    },

    updateSchoolCalendarRangePreviews() {
        SCHOOL_CALENDAR_TRIMESTERS.forEach(({ slug }) => {
            this.updateSchoolCalendarRangePreview(slug);
        });
    },

    updateSchoolCalendarRangePreview(slug) {
        const preview = $(`#calendar-${slug}-range`);
        if (!preview) return;

        const startDate = $(`#calendar-${slug}-start`)?.value || '';
        const weekCount = Number.parseInt($(`#calendar-${slug}-weeks`)?.value || '', 10);
        if (!startDate || !Number.isInteger(weekCount) || weekCount <= 0) {
            preview.textContent = 'Set start and weeks';
            return;
        }

        const firstWeek = calculateCalendarWeekRange(startDate, 1);
        const lastWeek = calculateCalendarWeekRange(startDate, weekCount);
        const firstLabel = this.formatCalendarDateRange(firstWeek.startDate, firstWeek.endDate);
        const lastLabel = this.formatCalendarDateRange(lastWeek.startDate, lastWeek.endDate);
        preview.textContent = `Week 1: ${firstLabel} · Week ${weekCount}: ${lastLabel}`;
    },

    formatCalendarDateRange(startDate, endDate) {
        const start = this.formatCalendarShortDate(startDate);
        const end = this.formatCalendarShortDate(endDate);
        if (!start || !end) return 'Range unavailable';
        return `${start}-${end}`;
    },

    formatCalendarShortDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
        const [year, month, day] = String(value).split('-').map(Number);
        const date = new Date(year, month - 1, day, 12);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },

    async saveSchoolCalendarSettings() {
        const scheduleError = this.validateClassScheduleRows();
        const calendar = this.readSchoolCalendarFromUI();
        const errors = this.validateSchoolCalendar(calendar);
        const statusEl = $('#school-calendar-save-status');
        const saveBtn = $('#save-school-calendar-btn');

        if (scheduleError || errors.length > 0) {
            const message = scheduleError || errors[0];
            if (statusEl) statusEl.textContent = message;
            notifications.error(message);
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

            await settingsRepository.save(SCHOOL_CALENDAR_SETTINGS_KEY, {
                ...calendar,
                updatedAt: new Date().toISOString(),
                updatedBy: this.currentUser?.email || 'unknown'
            });

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
        let updated = 0;
        let skipped = 0;

        await Promise.all(cloudVocabs.map(async vocab => {
            if (!vocab.assignedDate) {
                skipped += 1;
                return;
            }

            updated += 1;
            await vocabularyRepository.update(vocab.id, {
                ...this.buildPlacementPatch(vocab.assignedDate, calendar),
                updatedAt: new Date().toISOString()
            });
        }));

        if (this.vocabSet?.assignedDate) {
            this.applyAssignedDatePlacement(this.vocabSet);
        }
        return { updated, skipped };
    }
};
