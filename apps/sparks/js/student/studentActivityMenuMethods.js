import { schoolContext } from '../services/schoolContext.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { captureStudentReport } from './studentReportSession.js';
import { createStudentFeatureStyleLoader } from './studentFeatureStyleLoader.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';

const loadMenuStyles = createStudentFeatureStyleLoader(() => import('./studentUnitMenuStyles.js'));
const aborted = () => new DOMException('The unit menu changed.', 'AbortError');

export class StudentActivityMenu {
    constructor(activities, { load = () => import('./studentUnitWorkspace.js'), loadStyles = loadMenuStyles,
        loadReportGenerator = () => import('../reportGenerator.js'), timeoutMs = 10000 } = {}) {
        this.activities = activities; this.sm = activities.sm;
        this.load = load; this.loadStyles = loadStyles; this.loadReportGenerator = loadReportGenerator; this.timeoutMs = timeoutMs;
        this.epoch = 0; this.controller = new AbortController(); this.workspace = null; this.module = null; this.presentationReady = false;
        this.renderGeneration = 0; this.isPreparing = false;
    }
    resetForSession() {
        this.epoch++; this.controller.abort(); this.controller = new AbortController();
        this.workspace?.dispose(); this.workspace = null; this.module = null; this.presentationReady = false;
        this.renderGeneration++; this.isPreparing = false;
    }
    capture() {
        const sm = this.sm, vocab = sm.currentVocab, user = sm.currentUser, mode = sm.authDisabled;
        const cloud = sm.progress?.cloud, generation = cloud?.cloudGeneration, epoch = this.epoch;
        const session = this.activities.session, load = session?.vocabularyLoadId;
        const unit = this.activities.getUnitProgressKey?.(vocab) || vocab?.assignmentId || vocab?.id || vocab?.name;
        const school = schoolContext.getGeneration(), navigation = sm.routing?.arcadeReadController?.signal;
        const route = globalThis.location?.hash, lifecycle = this.controller.signal;
        const current = () => !lifecycle.aborted && !navigation?.aborted && epoch === this.epoch
            && user === sm.currentUser && mode === sm.authDisabled && vocab === sm.currentVocab
            && unit === (this.activities.getUnitProgressKey?.(sm.currentVocab) || sm.currentVocab?.assignmentId || sm.currentVocab?.id || sm.currentVocab?.name)
            && cloud === sm.progress?.cloud && generation === cloud?.cloudGeneration
            && load === session?.vocabularyLoadId && school === schoolContext.getGeneration()
            && navigation === sm.routing?.arcadeReadController?.signal && route === globalThis.location?.hash;
        return { current, lifecycle, navigation };
    }
    snapshot(lease) {
        return { isCurrent: lease.current, currentVocab: this.sm.currentVocab, subjects: this.sm.subjects, unitScores: this.sm.unitScores, unitStates: this.sm.unitStates };
    }
    capabilities() {
        const a = this.activities;
        const readers = Object.freeze(Object.fromEntries(['formatVocabularyCardTitle', 'formatVocabularyCardDescription', 'getVocabSchedule',
            'getTrimesterLabel', 'getVocabTrimesterKey', 'getMonthLabel', 'getWordCoverageStats', 'getActivityFlowConfig',
            'getActivityPlayableCount', 'getRequiredCompletion', 'isActivityComplete', 'isActivityUnlocked', 'updateOverallCoverageDisplay', 'scheduleActivityPreload']
            .map(name => [name, (...args) => a[name](...args)])));
        return Object.freeze({ readers, loadReportGenerator: this.loadReportGenerator,
            useExportPopover: this.sm.isTeacherUnitPreview !== true,
            showView: current => { if (current()) this.sm.switchView('activity-menu-view'); } });
    }
    async prepare(lease, { styles = true, signal: callerSignal } = {}) {
        if (!lease.current()) throw aborted();
        const controller = new AbortController(), cancel = () => controller.abort();
        const signals = [...new Set([lease.lifecycle, lease.navigation, callerSignal].filter(Boolean))];
        signals.forEach(signal => { if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true }); });
        let pending;
        try {
            return await requestWithTimeout(async signal => {
                if (!this.module) {
                    const pending = Promise.resolve().then(this.load).catch(error => { if (this.module === pending) this.module = null; throw error; });
                    this.module = pending;
                }
                pending = this.module;
                const [module] = await Promise.all([pending, styles ? this.loadStyles() : null]);
                if (!lease.current() || signal.aborted) throw aborted();
                // The facade is private and receives only fixed readers and a scoped view action.
                this.workspace ||= module.createStudentUnitWorkspace(this.capabilities());
                if (styles) this.presentationReady = true;
                return this.workspace;
            }, { signal: controller.signal, timeoutMs: this.timeoutMs, label: 'Loading unit menu' });
        } catch (error) {
            if (!lease.current()) throw aborted();
            if (error.code === 'REQUEST_TIMEOUT' && this.module === pending) this.module = null;
            throw error;
        } finally { signals.forEach(signal => signal.removeEventListener('abort', cancel)); }
    }
    async showActivityMenu(options = {}) {
        if (!this.sm.currentVocab) return;
        if (!options.fromRoute) {
            const unitId = this.sm.getCurrentVocabRouteId?.();
            if (unitId) this.sm.setRoute({ view: 'unit', unitId });
        }
        const lease = this.capture(), generation = ++this.renderGeneration;
        const current = () => lease.current() && generation === this.renderGeneration;
        const view = document.getElementById('activity-menu-view');
        const grid = view?.querySelector('.activities-grid');
        if (!view || !grid) return;
        this.isPreparing = true;
        setStudentPageLoading(view, true);
        grid.innerHTML = getStudentPageSkeleton('unit', 'Loading unit');
        view.querySelector(':popover-open')?.hidePopover();
        const exports = document.getElementById('completed-activity-export-options');
        if (exports) exports.replaceChildren();
        for (const id of ['current-unit-title', 'current-unit-description', 'current-unit-subject']) {
            const node = document.getElementById(id); if (node) node.textContent = id === 'current-unit-title' ? 'Loading unit' : '';
        }
        this.sm.switchView('activity-menu-view');
        try {
            const workspace = await this.prepare(lease);
            if (current()) workspace.render(this.snapshot(lease), options);
        } catch (error) {
            if (!current()) return;
            grid.innerHTML = '<div role="alert" class="unit-menu-load-error"><h2>Unit did not load</h2><p>Check Wi-Fi and try again. If retrying does not help, reload the page.</p><button type="button" class="btn primary-btn" data-unit-menu-retry>Try again</button></div>';
            grid.querySelector('[data-unit-menu-retry]').addEventListener('click', () => { void this.showActivityMenu({ ...options, fromRoute: true }); });
        } finally {
            if (generation === this.renderGeneration) this.isPreparing = false;
            if (current()) setStudentPageLoading(view, false);
        }
    }
    refreshVisible() {
        const view = globalThis.document?.querySelector?.('#activity-menu-view');
        if (this.isPreparing || !this.presentationReady || !this.workspace || !this.sm.currentVocab || !view?.classList.contains('active')) return;
        const lease = this.capture(); if (!lease.current()) return;
        try { this.workspace.render(this.snapshot(lease), { fromRoute: true, skipActivityPreload: true }); }
        catch (error) { console.warn('Could not refresh the current unit menu:', error); }
    }
    updateVisibleGates(cards, flow) {
        if (this.isPreparing || !this.presentationReady || !this.workspace || !globalThis.document?.querySelector?.('#activity-menu-view')?.classList.contains('active')) return;
        const lease = this.capture(); if (lease.current()) this.workspace.updateGates(this.snapshot(lease), cards, flow);
    }
    async downloadCompletedActivityReport(type) {
        const scoreData = this.sm.unitScores?.[type];
        if (!scoreData || (!scoreData.isComplete && Number(scoreData.score) < 100)) throw new Error('Complete this activity before exporting its PDF.');
        const lease = this.capture();
        const report = captureStudentReport(this.sm, { scoreData, unitProgress: this.activities.getCurrentUnitProgress(), states: this.sm.unitStates });
        const controller = new AbortController(), cancel = () => controller.abort();
        const signals = [...new Set([lease.lifecycle, lease.navigation].filter(Boolean))];
        signals.forEach(signal => { if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true }); });
        const assertReport = report.assertCurrent;
        try {
            return await requestWithTimeout(async signal => {
                report.assertCurrent = () => { if (signal.aborted || !lease.current()) throw aborted(); assertReport(); };
                const workspace = await this.prepare(lease, { styles: false, signal });
                report.assertCurrent();
                return workspace.downloadActivityReport(report, type);
            }, { signal: controller.signal, timeoutMs: this.timeoutMs, label: 'Exporting activity report' });
        } catch (error) { if (!lease.current()) throw aborted(); throw error; }
        finally { signals.forEach(signal => signal.removeEventListener('abort', cancel)); }
    }
}
