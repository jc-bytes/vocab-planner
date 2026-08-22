export function hasConsistentMultipleChoiceState(state, totalQuestions) {
    const score = Number(state?.score);
    const answeredCount = Number(state?.answeredCount);
    if (!Number.isInteger(score) || !Number.isInteger(answeredCount)) return false;
    if (score < 0 || answeredCount < 0 || score > answeredCount || answeredCount > totalQuestions) {
        return false;
    }

    if (!Array.isArray(state.selectedAnswers)) return answeredCount === 0;
    const answers = state.selectedAnswers.filter(Boolean);
    if (answers.length !== answeredCount) return false;
    if (answers.some(answer => typeof answer?.isCorrect !== 'boolean')) return false;
    return answers.filter(answer => answer.isCorrect).length === score;
}
