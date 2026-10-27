import { loadStudentSparkStyles } from './studentLibraryStyleLoader.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { schoolContext } from '../services/schoolContext.js';
import { getReleasedClassSparks, getAutomaticClassSparkLocation } from './studentClassSparkModel.js';
import { renderClassSparkLibrary, sparkBreadcrumb, renderSparkViewToggle } from './studentClassSparkLibrary.js';
import { classroomRepository } from '../services/classroomRepository.js';
import { createClassSparkReader } from './studentClassSparkReader.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

async function prepareSparkStyles(load, { signal, navigation, timeoutMs }) {
    const controller = new AbortController(), cancel = () => controller.abort();
    const signals = [...new Set([signal, navigation].filter(Boolean))];
    for (const current of signals) {
        if (current.aborted) cancel();
        else current.addEventListener('abort', cancel, { once: true });
    }
    try { return await requestWithTimeout(() => load(), { signal: controller.signal, timeoutMs, label: 'Loading Sparks styles' }); }
    finally { for (const current of signals) current.removeEventListener('abort', cancel); }
}

export async function showStudentClassSparks(routing, route = routing.sm.parseRoute(), { loadStyles: prepareStyles = loadStudentSparkStyles, timeoutMs = 10000 } = {}) {
    const { sm } = routing;
    if (!routing.sparkViewMode) {
        try { routing.sparkViewMode = localStorage.getItem('student_sparks_view_mode') === 'rows' ? 'rows' : 'cards'; }
        catch { routing.sparkViewMode = 'cards'; }
    }
    const owner = sm.currentUser?.uid || sm.currentUser?.id;
    const user = sm.currentUser;
    const cloud = sm.progress?.cloud, cloudGeneration = cloud?.cloudGeneration;
    const styleSchool = schoolContext.getGeneration();
    let school = styleSchool;
    const initialSelection = sm.activities.vocabularyData.classSelection;
    const styleSelection = initialSelection?.ready ? initialSelection : null;
    const styleClassGeneration = styleSelection?.generation, styleClassId = styleSelection?.selectedId;
    const scope = JSON.stringify([owner, styleSchool, initialSelection?.selectedId, route, routing.sparkViewMode]);
    let navigation = sm.routing?.arcadeReadController?.signal;
    const generation = routing.gamesGeneration;
    const request = routing.sparkReadGeneration = (routing.sparkReadGeneration || 0) + 1;
    routing.sparkReadController?.abort();
    const controller = routing.sparkReadController = new AbortController();
    const signal = controller.signal;
    const view = document.getElementById('student-sparks-view');
    const root = document.getElementById('student-sparks-library');
    const repository = routing.sparkRepository || classroomRepository;
    let classId;
    const current = () => !signal.aborted && request === routing.sparkReadGeneration
        && generation === routing.gamesGeneration && school === schoolContext.getGeneration() && owner === (sm.currentUser?.uid || sm.currentUser?.id)
        && user === sm.currentUser && !navigation?.aborted
        && cloud === sm.progress?.cloud && cloudGeneration === cloud?.cloudGeneration
        && navigation === sm.routing?.arcadeReadController?.signal
        && sm.parseRoute()?.view === 'sparks'
        && ['all','trimester','month','sparkId'].every(key => (sm.parseRoute()?.[key] || null) === (route[key] || null))
        && (!classId || classId === sm.activities.vocabularyData.classSelection?.selectedId);
    const styleCurrent = () => current() && styleSchool === schoolContext.getGeneration()
        && (!styleSelection || styleSelection === sm.activities.vocabularyData.classSelection
            && styleClassGeneration === styleSelection.generation && styleClassId === styleSelection.selectedId);
    const showMessage = text => root.replaceChildren(element('p', text, 'teacher-empty-state'));
    sm.cleanupActivity();
    sm.currentVocab = null;
    if (!view.classList.contains('active')) sm.switchView('student-sparks-view');
    view.scrollTop = 0;
    root.classList.remove('classrooms');
    delete root.dataset.classLoading;
    setStudentPageLoading(view, true);
    const keepContent = !route.sparkId && root.dataset.loadedScope === scope;
    let showLoadedContent = keepContent;
    if (!keepContent) root.innerHTML = getStudentPageSkeleton(route.sparkId ? 'sparks' : route.month ? 'units' : 'months', 'Loading Sparks');
    let stylesReady = false;
    try {
        await prepareSparkStyles(prepareStyles, { signal, navigation, timeoutMs });
        if (!styleCurrent()) return;
        stylesReady = true;
        renderSparkViewToggle(routing.sparkViewMode, mode => {
            routing.sparkViewMode = mode;
            try { localStorage.setItem('student_sparks_view_mode', mode); } catch { /* Keep this session's preference when storage is unavailable. */ }
            void showStudentClassSparks(routing, sm.parseRoute());
        }, Boolean(route.sparkId));
        if (await sm.activities.vocabularyData.loadClassSelection() === false) return;
        school = schoolContext.getGeneration();
        if (!current()) return;
        const selection = sm.activities.vocabularyData.classSelection;
        classId = selection.selectedId;
        sm.activities.vocabularyData.renderSubjectPicker('#spark-subject-picker');
        sm.activities.vocabularyData.renderSubjectPicker('#student-subject-picker');
        const selected = selection.classes.find(item => item.id === classId);
        if (!selected || selected.archived) { showMessage('No current Spark is available for this class.'); return; }
        const assignments = await repository.listAssignments(classId, { signal });
        if (!current()) return;
        const items = getReleasedClassSparks(assignments, sm.activities.schoolCalendar);
        if (!route.all && !route.trimester && !route.month && !route.sparkId) {
            const location = getAutomaticClassSparkLocation(items, sm.activities.schoolCalendar);
            if (location) {
                route = { view: 'sparks', ...location };
                sm.setRoute(route, { replace: true });
                navigation = sm.routing?.arcadeReadController?.signal;
            }
        }
        const navigate = next => sm.navigateTo(next);
        if (!route.sparkId) {
            const staged = document.createElement('div');
            const incomplete = await renderClassSparkLibrary(staged, {items, route, navigate, repository, signal, current, viewMode:routing.sparkViewMode});
            if (!current()) return;
            if (!incomplete || !keepContent) root.replaceChildren(...staged.childNodes);
            if (incomplete) { showLoadedContent = true; throw incomplete; }
            root.dataset.loadedScope = JSON.stringify([owner, school, classId, route, routing.sparkViewMode]);
            return;
        }
        const selectedSpark = items.find(item => item.id === route.sparkId);
        if (!selectedSpark) {
            root.replaceChildren(sparkBreadcrumb({}, navigate), element('p', 'This Spark is not available for this class.', 'teacher-empty-state'));
            return;
        }
        const [assignment, responses] = await Promise.all([
            repository.readAssignment(selectedSpark.id, { signal }), repository.listResponses(selectedSpark.id, { signal })
        ]);
        if (!current()) return;
        const card = createClassSparkReader({ assignment, saved: responses[0], current, closed: selectedSpark.closed,
            saveCheck: (answers, revision) => repository.checkSpark(assignment.id, answers, revision, { ownerUserId: owner, signal }),
            saveResponse: (answer, revision) => repository.saveResponse(assignment.id, answer, revision, { ownerUserId: owner, signal })
        });
        const location = {trimester:selectedSpark.trimester,month:selectedSpark.month,sparkId:selectedSpark.id};
        root.replaceChildren(sparkBreadcrumb(location, navigate), card);
    } catch (error) {
        if (!current()) return;
        if (!stylesReady && !styleCurrent()) return;
        if (stylesReady) {
            const { showSectionLoadError } = await import('../ui/sectionRecovery.js');
            showSectionLoadError(root, { label: 'Sparks', error, current, keepContent: showLoadedContent,
                retry: () => showStudentClassSparks(routing, sm.parseRoute()) });
        }
        else {
            const message = element('p', 'Could not load Sparks styles. Try again, or reload the page if the problem continues.', 'student-library-load-error');
            message.setAttribute('role', 'alert');
            const retry = element('button', 'Try again', 'btn secondary-btn'); retry.type = 'button';
            retry.addEventListener('click', () => { void showStudentClassSparks(routing, sm.parseRoute()); });
            root.replaceChildren(message, retry);
        }
    }
    finally { if (current() && (stylesReady || styleCurrent())) setStudentPageLoading(view, false); }
}
