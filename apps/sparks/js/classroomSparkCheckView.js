export function createSparkCheckForm({ assignment, savedResponse, save, isCurrent }) {
    const form = document.createElement('form');
    const fields = new Map();
    let revision = savedResponse?.revision || 0;
    for (const question of assignment.content.questions) {
        const label = document.createElement('label'); label.textContent = question.prompt;
        const input = document.createElement(question.type === 'multiple_choice' ? 'select' : 'textarea');
        input.name = question.id; input.required = true;
        if (question.type === 'multiple_choice') {
            const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose an answer'; input.append(placeholder);
            question.options.forEach((text, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = text; input.append(option); });
        } else { input.minLength = 12; input.maxLength = 3000; }
        input.value = String(savedResponse?.answers?.[question.id] ?? '');
        fields.set(question.id, { input, type: question.type }); label.append(input); form.append(label);
    }
    const button = document.createElement('button'); button.type = 'submit'; button.className = 'btn primary-btn'; button.textContent = 'Check answers';
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    const showResult = evaluation => {
        if (!evaluation) return;
        feedback.textContent = evaluation.automaticTotal ? `${evaluation.correct} of ${evaluation.automaticTotal} multiple-choice answers correct.` : 'Written answers saved.';
        if (evaluation.needsTeacherReview) feedback.textContent += ' Your teacher will review your written answers.';
    };
    showResult(savedResponse?.evaluation);
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (button.disabled) return;
        button.disabled = true;
        try {
            const answers = Object.fromEntries([...fields].map(([id, { input, type }]) => [id, type === 'multiple_choice' ? Number(input.value) : input.value]));
            const saved = await save(answers, revision);
            if (!isCurrent() || !form.isConnected) return;
            revision = saved.revision; showResult(saved.evaluation);
        } catch (error) {
            if (isCurrent() && form.isConnected) feedback.textContent = error.message || 'Could not save answers. Please try again.';
        } finally { button.disabled = false; }
    });
    form.append(button, feedback); return form;
}
