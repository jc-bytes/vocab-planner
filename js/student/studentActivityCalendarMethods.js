import { settingsRepository } from '../services/settingsRepository.js';
import {
    SCHOOL_CALENDAR_LOCAL_KEY,
    SCHOOL_CALENDAR_SETTINGS_KEY,
    getCurrentTrimesterFromCalendar,
    normalizeSchoolCalendar
} from '../services/vocabularyApi.js';

class StudentActivityCalendarMethods {
    scheduleIdleTask(callback, timeout = 1500) {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(callback, { timeout });
        } else {
            window.setTimeout(callback, timeout);
        }
    }

    getCurrentTrimesterKey(date = new Date()) {
        const calendarTrimester = getCurrentTrimesterFromCalendar(date, this.sm.schoolCalendar);
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
                this.sm.schoolCalendar = localCalendar ? normalizeSchoolCalendar(localCalendar) : null;
            } catch (error) {
                console.error('Failed to load local school calendar:', error);
                this.sm.schoolCalendar = null;
            }
            return;
        }

        if (!this.sm.currentUser) {
            this.sm.schoolCalendar = null;
            return;
        }

        try {
            const settings = await settingsRepository.get(SCHOOL_CALENDAR_SETTINGS_KEY);
            this.sm.schoolCalendar = settings ? normalizeSchoolCalendar(settings) : null;
        } catch (error) {
            console.error('Failed to load school calendar:', error);
            this.sm.schoolCalendar = null;
        }
    }
}

export function installStudentActivityCalendarMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityCalendarMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityCalendarMethods.prototype, name)
        );
    }
}
