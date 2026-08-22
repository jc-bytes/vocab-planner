const REPORT_INTERVAL_SECONDS = 30;

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export class StudentActivityWorkTimer {
    constructor({ onReport = null, now = () => Date.now() } = {}) {
        this.onReport = typeof onReport === 'function' ? onReport : null;
        this.now = now;
        this.attemptId = '';
        this.activeMilliseconds = 0;
        this.timeLimitSeconds = null;
        this.runningSince = null;
        this.intervalId = null;
        this.windowFocused = true;
        this.lastReportedSeconds = 0;
        this.boundVisibilityChange = () => this.handleVisibilityChange();
        this.boundFocus = () => this.handleFocus();
        this.boundBlur = () => this.handleBlur();
    }

    start(attempt = {}) {
        this.destroy();
        this.attemptId = String(attempt.attemptId || '');
        const serverSeconds = Math.max(0, Number(attempt.activeSeconds) || 0);
        const storedSeconds = this.loadStoredSeconds(this.attemptId);
        this.activeMilliseconds = Math.max(serverSeconds, storedSeconds) * 1000;
        const limit = Number(attempt.timeLimitSeconds);
        this.timeLimitSeconds = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
        this.lastReportedSeconds = serverSeconds;
        this.windowFocused = typeof document?.hasFocus === 'function' ? document.hasFocus() : true;
        this.bindListeners();
        this.render();
        this.resume();
        return this.getSnapshot();
    }

    bindListeners() {
        document?.addEventListener?.('visibilitychange', this.boundVisibilityChange);
        window?.addEventListener?.('focus', this.boundFocus);
        window?.addEventListener?.('blur', this.boundBlur);
    }

    unbindListeners() {
        document?.removeEventListener?.('visibilitychange', this.boundVisibilityChange);
        window?.removeEventListener?.('focus', this.boundFocus);
        window?.removeEventListener?.('blur', this.boundBlur);
    }

    canRun() {
        return Boolean(this.attemptId && this.timeLimitSeconds)
            && document?.visibilityState !== 'hidden'
            && this.windowFocused;
    }

    resume() {
        if (this.runningSince !== null || !this.canRun()) return;
        this.runningSince = this.now();
        this.intervalId = setInterval(() => this.tick(), 1000);
    }

    pause() {
        if (this.runningSince !== null) {
            this.activeMilliseconds += Math.max(0, this.now() - this.runningSince);
            this.runningSince = null;
            this.persist();
        }
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.render();
        return this.getSnapshot();
    }

    handleVisibilityChange() {
        if (document?.visibilityState === 'hidden') this.pause();
        else this.resume();
    }

    handleFocus() {
        this.windowFocused = true;
        this.resume();
    }

    handleBlur() {
        this.windowFocused = false;
        this.pause();
    }

    getActiveSeconds() {
        const runningMilliseconds = this.runningSince === null
            ? 0
            : Math.max(0, this.now() - this.runningSince);
        return Math.floor((this.activeMilliseconds + runningMilliseconds) / 1000);
    }

    getSnapshot() {
        const activeSeconds = this.getActiveSeconds();
        return {
            attemptId: this.attemptId,
            activeSeconds,
            timeLimitSeconds: this.timeLimitSeconds,
            isLate: Boolean(this.timeLimitSeconds && activeSeconds > this.timeLimitSeconds)
        };
    }

    tick() {
        const snapshot = this.getSnapshot();
        this.persist(snapshot.activeSeconds);
        this.render(snapshot);
        if (snapshot.activeSeconds - this.lastReportedSeconds >= REPORT_INTERVAL_SECONDS) {
            this.lastReportedSeconds = snapshot.activeSeconds;
            void this.onReport?.(snapshot);
        }
    }

    render(snapshot = this.getSnapshot()) {
        const indicator = document?.querySelector?.('#activity-time-indicator');
        if (!indicator) return;
        if (!snapshot.timeLimitSeconds) {
            indicator.hidden = true;
            indicator.textContent = '';
            indicator.classList?.remove?.('is-late');
            return;
        }

        indicator.hidden = false;
        indicator.classList?.toggle?.('is-late', snapshot.isLate);
        if (snapshot.isLate) {
            indicator.textContent = `Late by ${formatDuration(snapshot.activeSeconds - snapshot.timeLimitSeconds)}`;
            indicator.setAttribute?.('aria-label', `Activity is late by ${formatDuration(snapshot.activeSeconds - snapshot.timeLimitSeconds)} of active work time`);
        } else {
            indicator.textContent = `${formatDuration(snapshot.timeLimitSeconds - snapshot.activeSeconds)} left`;
            indicator.setAttribute?.('aria-label', `${formatDuration(snapshot.timeLimitSeconds - snapshot.activeSeconds)} of active work time left`);
        }
    }

    getStorageKey(attemptId = this.attemptId) {
        return attemptId ? `student_activity_active_time:${attemptId}` : '';
    }

    loadStoredSeconds(attemptId) {
        const key = this.getStorageKey(attemptId);
        if (!key) return 0;
        try {
            return Math.max(0, Number(localStorage.getItem(key)) || 0);
        } catch {
            return 0;
        }
    }

    persist(seconds = this.getActiveSeconds()) {
        const key = this.getStorageKey();
        if (!key) return;
        try {
            localStorage.setItem(key, String(Math.max(0, Math.floor(seconds))));
        } catch {
            // Server reporting still preserves time when browser storage is unavailable.
        }
    }

    markFinished() {
        const key = this.getStorageKey();
        this.destroy();
        if (!key) return;
        try {
            localStorage.removeItem(key);
        } catch {
            // The finished server attempt remains authoritative.
        }
    }

    destroy() {
        this.pause();
        this.unbindListeners();
        this.attemptId = '';
        this.timeLimitSeconds = null;
        this.activeMilliseconds = 0;
        this.runningSince = null;
        this.lastReportedSeconds = 0;
        this.render();
    }
}

