import { settingsRepository } from '../services/settingsRepository.js';
import {
    SCHOOL_CALENDAR_LOCAL_KEY,
    SCHOOL_CALENDAR_SETTINGS_KEY,
    getCurrentTrimesterFromCalendar,
    normalizeSchoolCalendar
} from '../services/vocabularyApi.js';

export class StudentActivityCalendar {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
        this.schoolCalendar = null;
    }

    scheduleIdleTask(callback, timeout = 1500) {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(callback, { timeout });
        } else {
            window.setTimeout(callback, timeout);
        }
    }

    getCurrentTrimesterKey(date = new Date()) {
        const calendarTrimester = getCurrentTrimesterFromCalendar(date, this.schoolCalendar);
        if (calendarTrimester) return calendarTrimester;

        const month = date.getMonth() + 1;

        if (month >= 3 && month <= 5) return 'IT';
        if (month >= 6 && month <= 8) return 'IIT';
        return 'IIIT';
    }

    async loadSchoolCalendar() {
        if (this.sm.authDisabled) {
            try {
                const localCalendar = JSON.parse(localStorage.getItem(SCHOOL_CALENDAR_LOCAL_KEY) || 'null');
                this.schoolCalendar = localCalendar ? normalizeSchoolCalendar(localCalendar) : null;
            } catch (error) {
                console.error('Failed to load local school calendar:', error);
                this.schoolCalendar = null;
            }
            return;
        }

        if (!this.sm.currentUser) {
            this.schoolCalendar = null;
            return;
        }

        try {
            const settings = await settingsRepository.get(SCHOOL_CALENDAR_SETTINGS_KEY);
            this.schoolCalendar = settings ? normalizeSchoolCalendar(settings) : null;
        } catch (error) {
            console.error('Failed to load school calendar:', error);
            this.schoolCalendar = null;
        }
    }
}
