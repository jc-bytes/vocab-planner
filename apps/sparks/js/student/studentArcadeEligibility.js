import { schoolContext } from '../services/schoolContext.js';
import { requestWithTimeout } from '../services/requestReliability.js';

// Display helpers may use snapshots. Entry, play and new purchases must first
// establish that an empty assignment list is a successful read, not a pending one.
async function readEligibility(sm, { isCurrent = () => true, onPending } = {}) {
    const user = sm.currentUser;
    const owner = user?.uid || user?.id;
    const local = sm.authDisabled === true;
    const authMode = sm.authDisabled;
    const cloud = sm.progress?.cloud;
    const generation = cloud?.cloudGeneration;
    const route = globalThis.window?.location?.hash;
    const current = () => isCurrent() && sm.currentUser === user
        && (sm.currentUser?.uid || sm.currentUser?.id) === owner && sm.authDisabled === authMode
        && sm.progress?.cloud === cloud && cloud?.cloudGeneration === generation
        && globalThis.window?.location?.hash === route;
    if (!current()) return null;
    const data = sm.activities?.vocabularyData;
    if (!local) {
        if (!owner || !data?.loadClassSelection) throw new Error('Class assignments are not ready. Please try again.');
        const pending = data.loadClassSelection({ onPending });
        const selectionRead = data.classSelection;
        if (selectionRead?.pending) onPending?.(selectionRead, {
            pending: selectionRead.pending, generation: selectionRead.generation, owner: selectionRead.owner
        });
        await pending;
        if (!current()) return null;
        const selection = data.classSelection;
        if (!selection?.ready || selection.owner !== owner
            || selection.readySchoolGeneration !== schoolContext.getGeneration()) {
            throw new Error('Class assignments are not ready. Please try again.');
        }
    }
    const schoolGeneration = schoolContext.getGeneration();
    const selection = data?.classSelection;
    const classGeneration = selection?.generation;
    const stillCurrent = () => current() && schoolGeneration === schoolContext.getGeneration()
        && (local || selection === data.classSelection && selection.ready && selection.generation === classGeneration);
    await sm.activities?.refreshCurrentSparkGate?.({ updateDisplay: false });
    if (!stillCurrent()) return null;
    const access = sm.activities?.getPendingRequiredWork?.();
    if (!access || typeof access.isBlocked !== 'boolean') throw new Error('Required work could not be checked. Please try again.');
    return { access, isCurrent: stillCurrent };
}

export async function prepareArcadeEligibility(sm, options = {}) {
    const controller = new AbortController();
    const navigation = sm.routing?.arcadeReadController?.signal;
    const cancel = () => controller.abort();
    let classRead;
    navigation?.addEventListener('abort', cancel, { once: true });
    const unsubscribe = schoolContext.subscribe(() => {
        const selection = sm.activities?.vocabularyData?.classSelection;
        const selected = selection?.classes?.find(item => item.id === selection.selectedId);
        // Loading the student's selected class may establish its school itself.
        if (selected?.schoolId !== schoolContext.getSchoolId()) cancel();
    });
    try {
        if (navigation?.aborted) return null;
        return await requestWithTimeout(signal => readEligibility(sm, {
            ...options, onPending: (selection, read) => { classRead = { selection, read }; },
            isCurrent: () => !signal.aborted && !navigation?.aborted
                && (!navigation || navigation === sm.routing?.arcadeReadController?.signal)
                && (options.isCurrent?.() ?? true)
        }), { signal: controller.signal, timeoutMs: options.timeoutMs || 10000, label: 'Required Arcade work' });
    } catch (error) {
        if (controller.signal.aborted) return null;
        if (error.code === 'REQUEST_TIMEOUT') classRead?.selection.cancelRead(classRead.read);
        throw error;
    } finally {
        navigation?.removeEventListener('abort', cancel);
        unsubscribe();
    }
}

export function showArcadeEligibilityError(sm) {
    sm.cleanupActivity?.();
    sm.currentVocab = null;
    const view = document.getElementById('loading-view');
    if (!view) return;
    view.innerHTML = '<div class="card" role="status"><h2>Arcade could not load</h2><p>Your required class work could not be checked. Please try again.</p><button class="btn primary-btn" data-arcade-retry>Try again</button> <button class="btn secondary-btn" data-arcade-back>Back to dashboard</button></div>';
    view.querySelector('[data-arcade-retry]').addEventListener('click', () => sm.navigateTo({ view: 'arcade' }));
    view.querySelector('[data-arcade-back]').addEventListener('click', () => sm.navigateTo({ view: 'menu' }));
    sm.switchView('loading-view');
}
