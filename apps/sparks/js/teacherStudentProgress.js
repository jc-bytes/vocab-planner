import { schoolContext } from './services/schoolContext.js';
import { requestWithTimeout } from './services/requestReliability.js';
import { loadTeacherFeature, getTeacherFeatureContext, getLoadedTeacherFeatureContext, disposeTeacherFeatureContext } from './teacherLazyFeatures.js';

const sessions = new WeakMap();
function session(manager) {
    if (!sessions.has(manager)) sessions.set(manager, { generation: 0, reads: new Set(), roster: [], filtered: [], selected: new Set() });
    return sessions.get(manager);
}

// Exports are data requests: view navigation must neither swallow their errors
// nor turn their result into undefined. Session/school replacement still cancels.
export async function loadTeacherStudentRoster(manager, options = {}, { load = () => loadTeacherFeature('studentProgress') } = {}) {
    const state = session(manager), generation = state.generation;
    const user = manager.currentUser, mode = manager.authDisabled;
    const school = schoolContext.getGeneration();
    const current = () => generation === state.generation && manager.currentUser === user
        && manager.authDisabled === mode && school === schoolContext.getGeneration();
    const assertCurrent = () => { if (!current()) throw new DOMException('Teacher session changed.', 'AbortError'); };
    const controller = new AbortController();
    state.reads.add(controller);
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    else options.signal?.addEventListener('abort', abort, { once: true });
    const unsubscribe = schoolContext.subscribe(() => { if (!current()) abort(); });
    return requestWithTimeout(async signal => {
        const check = () => { assertCurrent(); signal.throwIfAborted(); };
        check();
        const feature = await requestWithTimeout(() => load(), { signal, timeoutMs: 10000, label: 'Loading student records' });
        check();
        const context = getTeacherFeatureContext(manager, 'studentProgress', feature);
        const result = await context.getStudentRosterData({ ...options, signal, isCurrent: () => current() && !signal.aborted });
        check();
        return result;
    }, { signal: controller.signal, timeoutMs: options.timeoutMs || 30000, label: 'Loading student roster' }).catch(error => {
        if (error.code === 'REQUEST_ABORTED') error.name = 'AbortError';
        throw error;
    }).finally(() => {
        state.reads.delete(controller);
        options.signal?.removeEventListener('abort', abort);
        unsubscribe();
    });
}

export function installTeacherStudentProgressMethods(TeacherManager) {
    TeacherManager.prototype.getStudentRosterData = function(options) { return loadTeacherStudentRoster(this, options); };
    TeacherManager.prototype.clearStudentProgressSessionState = function() {
        const state = session(this);
        state.generation++;
        for (const read of state.reads) read.abort();
        state.reads.clear();
        state.roster = []; state.filtered = []; state.selected.clear();
        disposeTeacherFeatureContext(this, 'studentProgress');
    };
    const readers = {
        allStudentData: ['getRoster', 'roster'], filteredStudentData: ['getFilteredRoster', 'filtered'],
        selectedStudents: ['getSelectedStudents', 'selected'], activeStudentId: ['getActiveStudentId', null],
        activeStudentProfileTab: ['getActiveStudentProfileTab', null]
    };
    for (const [name, [read, fallback]] of Object.entries(readers)) {
        Object.defineProperty(TeacherManager.prototype, name, { configurable: true,
            get() { return getLoadedTeacherFeatureContext(this, 'studentProgress')?.[read]() ?? (fallback ? session(this)[fallback] : null); }
        });
    }
    Object.defineProperty(TeacherManager.prototype, 'studentProgressSessionGeneration', {
        configurable: true, get() { return session(this).generation; }
    });
}
