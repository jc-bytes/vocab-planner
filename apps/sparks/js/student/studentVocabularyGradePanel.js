import { classroomRepository } from '../services/classroomRepository.js';
import { getActivityLabel } from '../activityMetadata.js';
import '../../css/student-vocabulary-grade.css';

const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
const points = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const finite = value => typeof value === 'number' && Number.isFinite(value);

// This panel displays only a teacher-published server snapshot. Local activity
// scores and unsynced completions are never presented as a grade.
export function mountStudentVocabularyGradePanel({ root, assignmentId, classId, isCurrent, signals = [], repository = classroomRepository }) {
    const panel = node('section', undefined, 'student-vocabulary-grade');
    panel.setAttribute('aria-label', 'Published vocabulary grade');
    panel.hidden = true;
    const disclosure = node('details', undefined, 'student-vocabulary-grade-disclosure');
    const scoreControl = node('summary', '', 'student-vocabulary-grade-score');
    scoreControl.setAttribute('aria-label', 'Published grade details');
    const content = node('div', undefined, 'student-vocabulary-grade-content'); content.setAttribute('aria-live', 'polite');
    disclosure.append(scoreControl, content);
    panel.append(disclosure);
    root.querySelector('.activity-menu-status')?.append(panel);
    const dismiss = event => {
        if (event.type === 'keydown' && event.key === 'Escape') {
            if (disclosure.open) { disclosure.open = false; scoreControl.focus(); }
        } else if (event.type === 'pointerdown' && !panel.contains(event.target)) disclosure.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    panel.addEventListener('keydown', dismiss);
    let request = 0, disposed = false, controller;
    const current = () => !disposed && isCurrent() && panel.isConnected;
    const abort = () => { controller?.abort(); };
    signals.forEach(signal => signal.addEventListener('abort', abort, { once: true }));

    function button(label, action) {
        const control = node('button', label, 'btn secondary-btn'); control.type = 'button';
        control.addEventListener('click', () => { if (current()) action(); }); return control;
    }
    async function load() {
        if (!current() || signals.some(signal => signal.aborted)) return;
        const token = ++request;
        controller?.abort(); controller = new AbortController();
        content.replaceChildren(node('p', 'Loading published grade…'));
        panel.setAttribute('aria-busy', 'true');
        try {
            if (!classId) throw new Error('Assignment class unavailable.');
            const response = await repository.myVocabularyGrades(classId, { signal: controller.signal });
            if (!current() || token !== request || controller.signal.aborted || signals.some(signal => signal.aborted)) return;
            if (!Array.isArray(response?.grades)) throw new Error('Invalid grade response.');
            const grade = response.grades.find(item => item.assignmentId === assignmentId);
            content.replaceChildren();
            if (!grade) {
                panel.hidden = true; disclosure.open = false;
                return;
            }
            if (grade.status === 'unavailable' || !finite(grade.earnedPoints) || !finite(grade.maxPoints) || grade.maxPoints <= 0 || !finite(grade.percent)
                || !finite(grade.basePoints) || !finite(grade.bonusPoints) || !Array.isArray(grade.activities)) {
                panel.hidden = false; scoreControl.textContent = '—';
                scoreControl.setAttribute('aria-label', 'Published grade unavailable. Open details.');
                content.append(node('p', 'The published grade is unavailable. Ask your teacher to review this vocabulary.'), button('Check again', () => void load()));
                return;
            }
            panel.hidden = false;
            scoreControl.textContent = `${points(grade.earnedPoints)} / ${points(grade.maxPoints)}`;
            scoreControl.setAttribute('aria-label', `Published grade: ${points(grade.earnedPoints)} out of ${points(grade.maxPoints)}. Open details.`);
            const summary = node('div', undefined, 'student-vocabulary-grade-summary');
            const percent = node('span', `${points(grade.percent)}%`, 'student-vocabulary-grade-percent');
            summary.append(node('strong', 'Grade'), percent);
            content.append(summary, node('p', `Base ${points(grade.basePoints)} points · Extra ${points(grade.bonusPoints)} points`));
            const publication = grade.publishedAt ? new Date(grade.publishedAt) : null;
            content.append(node('p', publication && Number.isFinite(publication.getTime())
                ? `Published ${publication.toLocaleDateString()}. Your teacher may publish an updated grade later.`
                : 'Teacher-published grade. Your teacher may publish an updated grade later.', 'student-vocabulary-grade-caption'));
            const details = node('details'), detailTitle = node('summary', 'How this grade was earned'), list = node('ul');
            const rawBonus = grade.activities.filter(activity => !activity.required && activity.complete)
                .reduce((sum, activity) => sum + (finite(activity.points) ? activity.points : 0), 0);
            const limited = grade.bonusLimited === true || rawBonus > grade.bonusPoints + 0.001;
            for (const activity of grade.activities || []) {
                list.append(node('li', `${getActivityLabel(activity.activityType)} · ${activity.required ? 'Required' : 'Additional'} · ${activity.complete ? 'Complete' : 'Incomplete'} · ${points(activity.points)} points`));
            }
            details.append(detailTitle);
            if (limited) details.append(node('p', "Activity points below are before point limits. Extra points are limited by this vocabulary's grading settings."));
            details.append(list); content.append(details, button('Check for updates', () => void load()));
        } catch {
            if (!current() || token !== request || signals.some(signal => signal.aborted)) return;
            panel.hidden = false; scoreControl.textContent = '—';
            scoreControl.setAttribute('aria-label', 'Published grade could not be loaded. Open to retry.');
            content.replaceChildren(node('p', 'Published grades could not be loaded. Try again.'), button('Retry grade', () => void load()));
        } finally {
            if (current() && token === request) panel.setAttribute('aria-busy', 'false');
        }
    }
    void load();
    return { dispose() { disposed = true; request++; controller?.abort(); document.removeEventListener('pointerdown', dismiss); panel.removeEventListener('keydown', dismiss); signals.forEach(signal => signal.removeEventListener('abort', abort)); panel.remove(); } };
}
