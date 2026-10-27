import { getActivityStartupMessage, renderActivityStartupError, runActivityStartupStage } from './studentActivityStartupRecovery.js';
import { getStudentActivity } from './studentActivityRegistry.js';

// Keep activity construction and recovery off the dashboard's startup path.
export class LazyStudentActivityLauncher {
    constructor(activities, load = () => import('./studentActivityLauncherMethods.js')) {
        this.activities = activities;
        this.load = load;
        this.generation = 0;
        this.isStarting = false;
    }

    cancelActivityLaunch() {
        this.generation += 1;
        this.isStarting = false;
    }

    async startActivity(type, options = {}) {
        const generation = ++this.generation;
        this.isStarting = true;
        try {
            const vocab = this.activities.sm.currentVocab;
            const route = globalThis.location?.hash;
            const navigation = this.activities.sm.routing?.arcadeReadController?.signal;
            const isCurrent = () => generation === this.generation && vocab === this.activities.sm.currentVocab
                && route === globalThis.location?.hash && !navigation?.aborted
                && navigation === this.activities.sm.routing?.arcadeReadController?.signal;
            let StudentActivityLauncher;
            try {
                ({ StudentActivityLauncher } = await runActivityStartupStage('launcher', () => this.load()));
            } catch (error) {
                if (!isCurrent()) return;
                const sm = this.activities.sm;
                const container = globalThis.document?.querySelector('#activity-container');
                if (!container) throw error;
                sm.switchView?.('activity-view');
                const view = globalThis.document?.querySelector('#activity-view');
                view?.setAttribute('aria-busy', 'false');
                view?.classList.remove('student-page-loading');
                this.setActivityHeaderTitle(type);
                renderActivityStartupError(container, {
                    error,
                    message: getActivityStartupMessage(error),
                    retry: () => { void this.startActivity(type, options).catch(error => console.error('Could not retry activity startup:', error)); },
                    back: () => { void sm.navigateTo({ view: 'unit', unitId: sm.getCurrentVocabRouteId() }).catch(error => console.error('Could not return to unit:', error)); }
                });
                return;
            }
            if (!isCurrent()) return;
            this.launcher ||= new StudentActivityLauncher(this.activities);
            return await this.launcher.startActivity(type, options);
        } finally {
            if (generation === this.generation) this.isStarting = false;
        }
    }

    setActivityHeaderTitle(type) {
        const title = document.querySelector('#activity-header-title');
        if (!title) return;
        title.textContent = getStudentActivity(type)?.title || '';
        title.classList.toggle('hidden', !title.textContent);
    }
}
