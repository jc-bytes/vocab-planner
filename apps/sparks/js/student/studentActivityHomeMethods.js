import { schoolContext } from '../services/schoolContext.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { getStudentPageSkeleton } from './studentLoadingSkeletons.js';
import { $, createElement } from '../main.js';
import { StudentActivityHomeSpark } from './studentActivityHomeSpark.js';
import { createStudentFeatureStyleLoader } from './studentFeatureStyleLoader.js';

const loadHomeStyles = createStudentFeatureStyleLoader(() => import('./studentHomeStyles.js'));

export class StudentActivityHome {
    constructor(activities, { loadHomeRenderer = () => import('./studentHomeRenderer.js'), loadStyles = loadHomeStyles } = {}) {
        this.loadHomeRenderer = loadHomeRenderer;
        this.loadStyles = loadStyles;
        this.activities = activities;
        this.sm = activities.sm;
        this.spark = new StudentActivityHomeSpark(this);
    }

    async preparePresentation({ isCurrent, timeoutMs = 10000 }) {
        return requestWithTimeout(async signal => {
            const [renderer] = await Promise.all([this.loadHomeRenderer(), this.loadStyles()]);
            if (signal.aborted || !isCurrent()) throw new DOMException('Home changed.', 'AbortError');
            return renderer;
        }, { timeoutMs, label: 'Loading Home' });
    }

    async renderStudentHome({ timeoutMs = 10000, forceRefresh = false } = {}) {
        const container = $('#student-home-dashboard');
        if (!container) return;
        const run = this.renderGeneration = (this.renderGeneration || 0) + 1;
        const owner = this.sm.currentUser;
        const ownerId = owner?.uid || owner?.id;
        const schoolGeneration = schoolContext.getGeneration();
        const route = globalThis.location?.hash;
        const navigation = this.sm.routing?.arcadeReadController?.signal;
        const selectedId = this.activities.vocabularyData?.classSelection?.selectedId;
        const current = () => (!selectedId || selectedId === this.activities.vocabularyData?.classSelection?.selectedId) && run === this.renderGeneration && owner === this.sm.currentUser
            && schoolGeneration === schoolContext.getGeneration() && route === globalThis.location?.hash
            && !navigation?.aborted && navigation === this.sm.routing?.arcadeReadController?.signal;
        if (this.readyOwner !== ownerId || this.readyClass !== selectedId) { this.ready = false; this.readyOwner = ownerId; }
        if (!this.ready) {
            container.innerHTML = getStudentPageSkeleton('dashboard');
            $('#main-menu-view')?.classList.add('student-home-loading');
        }
        $('#main-menu-view')?.setAttribute('aria-busy', 'true');
        try {
            const { renderStudentHomeContent } = await this.preparePresentation({ isCurrent: current, timeoutMs });
            if (current()) await renderStudentHomeContent.call(this, { isCurrent: current, forceRefresh });
        } catch (error) {
            if (!current()) return;
            container.textContent = 'Could not load Home. Open Units or try again. If retrying does not help, reload the page.';
            $('#main-menu-view')?.classList.remove('student-home-loading');
            $('#main-menu-view')?.setAttribute('aria-busy', 'false');
            const retry = createElement('button', 'btn secondary-btn', 'Try again');
            retry.type = 'button';
            retry.addEventListener('click', () => { void this.renderStudentHome(); });
            container.append(retry);
        }
    }

    renderSparkLibrary() {
        return this.spark.renderSparkLibrary();
    }

    normalizeSpark(spark = {}) {
        return this.spark.normalizeSpark(spark);
    }

    getStudentGradeLevel() {
        return this.spark.getStudentGradeLevel();
    }

    fetchCurrentSpark() {
        return this.spark.fetchCurrentSpark();
    }

    getCurrentSparkGateWork() {
        return this.spark.getCurrentSparkGateWork();
    }

    refreshCurrentSparkGate(options = {}) {
        return this.spark.refreshCurrentSparkGate(options);
    }

    loadAndRenderCurrentSpark(host, options = {}) {
        return this.spark.loadAndRenderCurrentSpark(host, options);
    }

}
