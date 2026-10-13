import { schoolContext } from '../services/schoolContext.js';
import { studentSchoolScope } from './studentSchoolSession.js';
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

    async loadSchoolCalendar(options = {}) {
        this.loadController?.abort();
        const run = this.loadGeneration = (this.loadGeneration || 0) + 1;
        const scope = studentSchoolScope(this.sm);
        const contextGeneration = schoolContext.getGeneration();
        const current = () => run === this.loadGeneration && scope.accountId === studentSchoolScope(this.sm).accountId && scope.schoolId === studentSchoolScope(this.sm).schoolId && contextGeneration === schoolContext.getGeneration();
        const cacheKey = this.sm.authDisabled ? SCHOOL_CALENDAR_LOCAL_KEY : scope.key && `${scope.key}:calendar`;
        this.schoolCalendar = null;
        if (this.sm.authDisabled || !navigator.onLine) {
            try {
                const localCalendar = JSON.parse((cacheKey ? localStorage.getItem(cacheKey) : null) || 'null');
                this.schoolCalendar = localCalendar ? normalizeSchoolCalendar(localCalendar) : null;
            } catch (error) {
                console.error('Failed to load local school calendar:', error);
                this.schoolCalendar = null;
            }
            return;
        }

        if (!this.sm.currentUser || !scope.schoolId) {
            this.schoolCalendar = null;
            return;
        }

        const controller = this.loadController = new AbortController();
        const cancel = () => controller.abort();
        options.signal?.addEventListener('abort', cancel, { once: true });
        if (options.signal?.aborted) cancel();
        const timer = setTimeout(cancel, Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 8000);
        let rejectCancellation;
        const cancelled = new Promise((_, reject) => {
            rejectCancellation = () => reject(new DOMException('School calendar request cancelled or timed out', 'AbortError'));
            if (controller.signal.aborted) rejectCancellation();
            else controller.signal.addEventListener('abort', rejectCancellation, { once: true });
        });
        try {
            const settings = await Promise.race([settingsRepository.get(SCHOOL_CALENDAR_SETTINGS_KEY, { ...options, signal: controller.signal }), cancelled]);
            if (!current()) return;
            this.schoolCalendar = settings ? normalizeSchoolCalendar(settings) : null;
            try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(this.schoolCalendar)); } catch { /* Optional offline cache. */ }
        } catch (error) {
            if (!current()) return;
            if (error.name !== 'AbortError') console.error('Failed to load school calendar:', error);
            this.schoolCalendar = null;
        } finally {
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', cancel);
            controller.signal.removeEventListener('abort', rejectCancellation);
        }
    }
}
