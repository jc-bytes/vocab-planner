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
    const title = node('h3', 'Grade');
    const content = node('div', undefined, 'student-vocabulary-grade-content'); content.setAttribute('aria-live', 'polite');
    panel.append(title, content);
    root.querySelector('.activities-grid')?.before(panel);
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
                content.append(node('p', 'No grade has been published for this vocabulary.'), button('Check for a grade', () => void load()));
                return;
            }
            if (grade.status === 'unavailable' || !finite(grade.earnedPoints) || !finite(grade.maxPoints) || grade.maxPoints <= 0 || !finite(grade.percent)
                || !finite(grade.basePoints) || !finite(grade.bonusPoints) || !Array.isArray(grade.activities)) {
                content.append(node('p', 'The published grade is unavailable. Ask your teacher to review this vocabulary.'), button('Check again', () => void load()));
                return;
            }
            const summary = node('div', undefined, 'student-vocabulary-grade-summary');
            const score = node('strong', `${points(grade.earnedPoints)} / ${points(grade.maxPoints)}`, 'student-vocabulary-grade-score');
            const percent = node('span', `${points(grade.percent)}%`, 'student-vocabulary-grade-percent');
            summary.append(score, percent);
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
            content.replaceChildren(node('p', 'Published grades could not be loaded. Try again.'), button('Retry grade', () => void load()));
        } finally {
            if (current() && token === request) panel.setAttribute('aria-busy', 'false');
        }
    }
    void load();
    return { dispose() { disposed = true; request++; controller?.abort(); signals.forEach(signal => signal.removeEventListener('abort', abort)); panel.remove(); } };
}
