import { schoolContext } from '../services/schoolContext.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';
import { loadStudentLibraryStyles } from './studentLibraryStyleLoader.js';

// Only the Units route can acquire its presentation. Data and shared labels are
// available separately to Home, deep links, Arcade eligibility and queue replay.
export async function renderStudentUnits(activities, { load = () => import('./studentActivityBrowserMethods.js'), loadStyles = loadStudentLibraryStyles, timeoutMs = 10000, forceRefresh = false } = {}) {
    const sm = activities.sm;
    if (sm.parseRoute?.()?.view !== 'units') return;
    const generation = activities.unitsRenderGeneration = (activities.unitsRenderGeneration || 0) + 1;
    const user = sm.currentUser;
    const cloud = sm.progress?.cloud;
    const session = cloud?.cloudGeneration;
    const route = globalThis.location?.hash;
    const navigation = sm.routing?.arcadeReadController?.signal;
    let school = null;
    const initialClass = activities.vocabularyData.classSelection?.selectedId;
    const ownerCurrent = () => !navigation?.aborted
        && (!navigation || navigation === sm.routing?.arcadeReadController?.signal) && generation === activities.unitsRenderGeneration
        && sm.currentUser === user && sm.progress?.cloud === cloud && cloud?.cloudGeneration === session
        && (!initialClass || initialClass === activities.vocabularyData.classSelection?.selectedId)
        && sm.parseRoute?.()?.view === 'units' && globalThis.location?.hash === route
        && (school === null || schoolContext.getGeneration() === school);
    let prepared;
    const current = () => ownerCurrent() && (!prepared || prepared.isCurrent());
    const view = document.getElementById('vocab-selection-view');
    const container = document.getElementById('vocab-list');
    if (!container) return;
    activities.unitsPresentationPreparing = true;
    setStudentPageLoading(view, true);
    const selection = activities.vocabularyData.classSelection;
    const keepContent = Boolean(selection?.hasSnapshot && selection.owner === (user?.uid || user?.id)
        && selection.snapshotClassId === selection.selectedId && selection.readySchoolGeneration === schoolContext.getGeneration()
        && activities.browser?.hasCurrentPresentation?.());
    // Clear prior private content unless it is the same complete rendered scope.
    if (!keepContent) container.innerHTML = getStudentPageSkeleton('units', 'Loading vocabulary units');
    try {
        prepared = await activities.vocabularyData.prepareClassData({
            signal: navigation, isCurrent: ownerCurrent, forceRefresh
        });
        if (!prepared?.isCurrent() || !current()) return;
        school = schoolContext.getGeneration();
        activities.vocabularyData.renderSubjectPicker('#student-subject-picker');
        const [{ StudentActivityBrowser }] = await requestWithTimeout(() => Promise.all([load(), loadStyles()]), {
            signal: navigation, timeoutMs, label: 'Loading Units'
        });
        if (!current()) return;
        activities.browser ||= new StudentActivityBrowser(activities);
        return await activities.browser.renderDashboard({ isCurrent: current, prepared });
    } catch (error) {
        if (!current()) return;
        const { showSectionLoadError, isAccessFailure } = await import('../ui/sectionRecovery.js');
        if (!current()) return;
        if (isAccessFailure(error)) activities.browser?.clearPresentation?.();
        showSectionLoadError(container, { label: 'Units', error, current, keepContent,
            retry: () => renderStudentUnits(activities, { forceRefresh: true }) });
    } finally {
        if (generation === activities.unitsRenderGeneration) activities.unitsPresentationPreparing = false;
        if (current()) setStudentPageLoading(view, false);
    }
}
