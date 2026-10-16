import { schoolContext } from '../services/schoolContext.js';
import '../../css/student-class-spark.css';
import { getReleasedClassSparks, formatClassSparkHeading, getAutomaticClassSparkLocation } from './studentClassSparkModel.js';
import { renderClassSparkLibrary, sparkBreadcrumb, renderSparkViewToggle } from './studentClassSparkLibrary.js';
import { classroomRepository } from '../services/classroomRepository.js';
import { createSparkCheckForm } from '../classroomSparkCheckView.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function step(tag, number, text) {
    const heading = element(tag, undefined, 'student-spark-step');
    heading.append(element('span', number, 'student-spark-step-number'), document.createTextNode(` ${text}`));
    return heading;
}

export async function showStudentClassSparks(routing, route = routing.sm.parseRoute()) {
    const { sm } = routing;
    if (!routing.sparkViewMode) {
        try { routing.sparkViewMode = localStorage.getItem('student_sparks_view_mode') === 'rows' ? 'rows' : 'cards'; }
        catch { routing.sparkViewMode = 'cards'; }
    }
    renderSparkViewToggle(routing.sparkViewMode, mode => {
        routing.sparkViewMode = mode;
        try { localStorage.setItem('student_sparks_view_mode', mode); } catch { /* Keep this session's preference when storage is unavailable. */ }
        void showStudentClassSparks(routing, sm.parseRoute());
    }, Boolean(route.sparkId));
    const owner = sm.currentUser?.uid || sm.currentUser?.id;
    const generation = routing.gamesGeneration;
    let school = schoolContext.getGeneration();
    const selectedClass = sm.activities.vocabularyData.classSelection?.selectedId;
    const scope = JSON.stringify([owner, selectedClass, route, routing.sparkViewMode]);
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
        && sm.parseRoute()?.view === 'sparks'
        && ['all','trimester','month','sparkId'].every(key => (sm.parseRoute()?.[key] || null) === (route[key] || null))
        && (!classId || classId === sm.activities.vocabularyData.classSelection?.selectedId);
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
    try {
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
            }
        }
        const navigate = next => sm.navigateTo(next);
        if (!route.sparkId) {
            const staged = document.createElement('div');
            const incomplete = await renderClassSparkLibrary(staged, {items, route, navigate, repository, signal, current, viewMode:routing.sparkViewMode});
            if (!current()) return;
            if (!incomplete || !keepContent) root.replaceChildren(...staged.childNodes);
            if (incomplete) { showLoadedContent = true; throw incomplete; }
            root.dataset.loadedScope = JSON.stringify([owner, classId, route, routing.sparkViewMode]);
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
        const content = assignment.content;
        const saved = responses[0];
        const card = element('article', undefined, 'student-current-class-spark');
        const introduction = element('header', undefined, 'student-class-spark-heading');
        const heading = formatClassSparkHeading(assignment.title);
        if (heading.context) introduction.append(element('p', heading.context, 'student-spark-context'));
        introduction.append(element('h2', heading.title));
        const reading = element('section', undefined, 'student-class-spark-reading');
        reading.append(step('p', '1', 'Read'), element('p', content.sparkText, 'student-spark-passage'));
        if (content.whyItMatters) {
            const connection = element('p', undefined, 'student-spark-connection');
            connection.append(element('strong', 'Why it matters'), document.createTextNode(content.whyItMatters));
            reading.append(connection);
        }
        const response = element('section', undefined, 'student-class-spark-questions');
        response.append(content.checkMode === 'reading_only' ? element('h3', 'Reading only') : step('h3', '2', 'Answer'));
        if (content.checkMode === 'reading_only') response.append(element('p', 'Read this Spark. No response is required.'));
        else if (content.questions?.length) {
            response.append(createSparkCheckForm({ assignment, savedResponse: saved, isCurrent: current,
                save: (answers, revision) => current()
                    ? repository.checkSpark(assignment.id, answers, revision)
                    : Promise.reject(new DOMException('Spark changed', 'AbortError')) }));
        } else {
            if (content.question) response.append(element('p', content.question));
            const form = document.createElement('form');
            const label = element('label', 'Your answer');
            const input = document.createElement('textarea');
            input.required = true; input.maxLength = 10000; input.value = saved?.response || '';
            input.placeholder = 'Write your answer here…';
            label.append(input);
            const submit = element('button', 'Save answer', 'btn primary-btn'); submit.type = 'submit';
            const feedback = element('p'); feedback.setAttribute('role', 'status');
            let revision = saved?.revision || 0;
            form.addEventListener('submit', async event => {
                event.preventDefault();
                if (!current() || !form.isConnected || submit.disabled) return;
                submit.disabled = true;
                try {
                    const result = await repository.saveResponse(assignment.id, input.value, revision);
                    if (current() && form.isConnected) { revision = result.revision; feedback.textContent = 'Answer saved. Your teacher will review it.'; }
                } catch (error) { if (current() && form.isConnected) feedback.textContent = error.message || 'Could not save. Please try again.'; }
                finally { if (form.isConnected) submit.disabled = false; }
            });
            form.append(label, submit, feedback); response.append(form);
        }
        if (selectedSpark.closed) {
            for (const control of response.querySelectorAll('textarea, select, button')) control.disabled = true;
            response.append(element('p', 'Closed. You can review this Spark and any saved answers.'));
        }
        const location = {trimester:selectedSpark.trimester,month:selectedSpark.month,sparkId:selectedSpark.id};
        card.append(introduction, reading, response); root.replaceChildren(sparkBreadcrumb(location, navigate), card);
    } catch (error) {
        if (!current()) return;
        const { showSectionLoadError } = await import('../ui/sectionRecovery.js');
        showSectionLoadError(root, { label: 'Sparks', error, current, keepContent: showLoadedContent,
            retry: () => showStudentClassSparks(routing, sm.parseRoute()) });
    }
    finally { if (current()) setStudentPageLoading(view, false); }
}
