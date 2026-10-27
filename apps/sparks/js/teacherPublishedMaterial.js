import { createAssignmentDialog, node } from './teacherAssignmentUi.js';

// Inspect the assignment snapshot, never the editable Library material.
export function openPublishedMaterial({ assignment, repository, isCurrent, signal }) {
    const view = createAssignmentDialog(assignment.title || 'Published material');
    view.footer.firstElementChild.textContent = 'Close';
    const status = node('p', 'Loading published material…'); status.setAttribute('role', 'status');
    view.body.append(status);
    const current = () => isCurrent() && view.dialog.isConnected;
    async function load() {
        try {
            const detail = await repository.readAssignment(assignment.id, { signal });
            if (!current()) return;
            if (!detail?.content) throw new Error('The published material is unavailable.');
            const content = detail.content;
            const body = node('section');
            body.append(node('p', 'Published copy. Later Library edits do not change this material.'));
            if (assignment.kind === 'vocabulary') {
                const list = node('dl');
                for (const word of content.words || []) list.append(node('dt', word.word), node('dd', word.definition));
                body.append(list);
                if (!content.words?.length) body.append(node('p', 'This published copy has no vocabulary words.'));
            } else {
                if (content.sparkText) body.append(node('p', content.sparkText, 'teacher-published-text'));
                if (content.whyItMatters) body.append(node('p', content.whyItMatters));
                if (content.checkMode === 'reading_only') body.append(node('p', 'Reading only. No response is required.'));
                else if (content.questions?.length) {
                    const questions = node('ol');
                    for (const question of content.questions) {
                        const item = node('li', question.prompt);
                        if (question.options?.length) {
                            const choices = node('ul');
                            for (const option of question.options) choices.append(node('li', typeof option === 'string' ? option : option.text || option.label || ''));
                            item.append(choices);
                        }
                        questions.append(item);
                    }
                    body.append(questions);
                } else if (content.question) body.append(node('p', content.question));
            }
            view.body.replaceChildren(body);
        } catch (error) {
            if (!current()) return;
            status.textContent = error.message || 'Could not load published material.';
            const retry = node('button', 'Try again', 'btn secondary-btn'); retry.type = 'button';
            retry.addEventListener('click', () => { if (current()) { view.body.replaceChildren(status); status.textContent = 'Loading published material…'; void load(); } });
            view.body.append(retry);
        }
    }
    void load();
    return view.close;
}
