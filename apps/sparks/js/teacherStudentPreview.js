import '../css/teacher-student-library.css';
import { cloneTeacherPreviewData } from './teacherPreviewData.js';
import { createElement } from './main.js';
import { loadVocabularyFile } from './services/vocabularyApi.js';
import { vocabularyRepository } from './services/vocabularyRepository.js';
import { formatVocabularyCardTitle } from './vocabularyCardView.js';

let activePreview;
function openEmbeddedPreview(title, isCurrent, sourceId = 'vocabulary-assign-panel') {
    activePreview?.close();
    const opener = document.activeElement;
    const library = document.getElementById(sourceId);
    const screen = createElement('section', 'teacher-unit-preview-screen');
    screen.setAttribute('aria-label', `Student preview: ${title}`);
    const back = createElement('button', 'btn secondary-btn', 'Back to library');
    back.type = 'button';
    const heading = createElement('h2', '', title);
    const header = createElement('header', 'teacher-library-browser-toolbar');
    header.append(back, heading);
    const note = createElement('p', 'teacher-preview-notice', 'Student preview. Try the activities here. Preview progress is cleared when you leave.');
    const body = createElement('div', 'teacher-preview-body');
    screen.append(header, note, body);
    library.classList.add('teacher-unit-preview-source-hidden');
    library.after(screen);
    const preview = { close() {
        clearInterval(watch); preview.cleanup?.(); preview.cleanup = null; screen.remove(); library.classList.remove('teacher-unit-preview-source-hidden');
        window.removeEventListener('message', receiveClose);
        if (activePreview === preview) activePreview = null;
        if (opener?.isConnected) opener.focus();
    } };
    const receiveClose = event => {
        if (event.origin === location.origin && event.source === body.querySelector('iframe')?.contentWindow && event.data?.type === 'teacher-unit-preview-close') preview.close();
    };
    const watch = setInterval(() => { if (!isCurrent() || !library.isConnected || library.classList.contains('hidden') || library.closest('.view')?.classList.contains('hidden')) preview.close(); }, 250);
    window.addEventListener('message', receiveClose);
    back.addEventListener('click', () => preview.close());
    activePreview = preview; back.focus(); screen.scrollIntoView({ block: 'start' });
    return { body, header, current: () => screen.isConnected && isCurrent(), preview };
}

function mountStudentFrame(context, payload, title) {
    const { body, current, preview } = context;
    preview.cleanup?.();
    const frame = createElement('iframe', 'teacher-unit-preview-frame');
    frame.title = `Student screen: ${title}`;
    // Supply the data before navigation. Startup no longer depends on a one-shot
    // cross-window ready message, which can leave the initial screen waiting.
    frame.teacherPreviewPayload = cloneTeacherPreviewData(payload);
    frame.src = new URL('student-preview.html', document.baseURI).href;
    let timeout;
    const fail = message => {
        if (!current()) return;
        clearTimeout(timeout);
        const error = createElement('p', '', message || 'The student preview did not start. Try again.');
        error.setAttribute('role', 'alert');
        const retry = createElement('button', 'btn secondary-btn', 'Try again'); retry.type = 'button';
        retry.addEventListener('click', () => mountStudentFrame(context, payload, title));
        body.replaceChildren(error, retry);
    };
    const receive = event => {
        if (!current() || event.source !== frame.contentWindow || event.origin !== location.origin) return;
        if (event.data?.type === 'teacher-unit-preview-mounted') clearTimeout(timeout);
        else if (event.data?.type === 'teacher-unit-preview-error') fail(event.data.message);
    };
    window.addEventListener('message', receive);
    timeout = setTimeout(() => fail(), 10000);
    preview.cleanup = () => { clearTimeout(timeout); window.removeEventListener('message', receive); };
    body.replaceChildren(frame);
}

export async function previewTeacherUnit(owner, metadata, type, isCurrent = () => true, options = {}) {
    const context = openEmbeddedPreview(formatVocabularyCardTitle(metadata), isCurrent, options.sourceId);
    const { body, current } = context;
    body.textContent = 'Loading unit…';
    try {
        const vocab = type === 'remote' ? await loadVocabularyFile(metadata.path)
            : type === 'cloud' ? await vocabularyRepository.get(metadata.id) : metadata;
        if (!current()) return;
        if (!vocab) throw new Error('This unit could not be loaded.');
        mountStudentFrame(context, { type: 'teacher-unit-preview', vocab, subjects: owner.getSubjects?.() || [],
            initialActivity: options.initialActivity }, formatVocabularyCardTitle(vocab));
    } catch (error) { if (current()) body.textContent = error.message || 'Could not load student preview.'; }
}

export function previewTeacherQuiz(owner, metadata, type, isCurrent = () => true) {
    return previewTeacherUnit(owner, metadata, type, isCurrent, {
        sourceId: 'vocabulary-quizzes-panel', initialActivity: 'quiz'
    });
}

export function previewTeacherSpark(spark, { isCurrent = () => true } = {}) {
    const context = openEmbeddedPreview(spark.title || 'Spark', isCurrent, document.getElementById('teacher-spark-library-panel') ? 'teacher-spark-library-panel' : 'spark-library-list');
    const grades = spark.targetGrades?.length ? spark.targetGrades : ['6', '7', '8', '9'];
    const label = createElement('label', 'teacher-preview-grade', 'Preview grade');
    const grade = createElement('select'); grade.setAttribute('aria-label', 'Preview grade');
    grades.forEach(value => { const option = createElement('option', '', `Grade ${value}`); option.value = value; grade.append(option); });
    label.append(grade); context.header.append(label);
    const render = () => {
        const content = { ...spark, question: spark.gradeQuestions?.[grade.value] || spark.question };
        mountStudentFrame(context, { type: 'teacher-spark-preview', spark: content, grade: grade.value }, spark.title || 'Spark');
    };
    grade.addEventListener('change', render); render();
}
