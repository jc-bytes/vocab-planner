import { formatClassSparkHeading } from './studentClassSparkModel.js';
import { createSparkCheckForm } from '../classroomSparkCheckView.js';

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

export function createClassSparkReader({ assignment, saved, current, closed = false, saveCheck, saveResponse }) {
        const content = assignment.content;

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
                    ? saveCheck(answers, revision)
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
                    const result = await saveResponse(input.value, revision);
                    if (current() && form.isConnected) { revision = result.revision; feedback.textContent = 'Answer saved. Your teacher will review it.'; }
                } catch (error) { if (current() && form.isConnected) feedback.textContent = error.message || 'Could not save. Please try again.'; }
                finally { if (form.isConnected) submit.disabled = false; }
            });
            form.append(label, submit, feedback); response.append(form);
        }
        if (closed) {
            for (const control of response.querySelectorAll('textarea, select, button')) control.disabled = true;
            response.append(element('p', 'Closed. You can review this Spark and any saved answers.'));
        }
        card.append(introduction, reading, response);
        return card;
}
