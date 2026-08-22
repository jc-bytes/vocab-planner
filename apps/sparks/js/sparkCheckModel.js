export const SPARK_CHECK_MODES = Object.freeze({
    READING_ONLY: 'reading_only',
    OPTIONAL: 'optional',
    REQUIRED: 'required'
});

export const SPARK_QUESTION_TYPES = Object.freeze({
    SHORT_TEXT: 'short_text',
    MULTIPLE_CHOICE: 'multiple_choice'
});

export const SPARK_RESPONSE_MIN_LENGTH = 12;
export const SPARK_QUESTION_LIMIT = 3;

export function normalizeSparkCheckMode(value) {
    const mode = String(value || '').trim();
    return Object.values(SPARK_CHECK_MODES).includes(mode) ? mode : SPARK_CHECK_MODES.OPTIONAL;
}

export function normalizeSparkQuestions(value) {
    const source = Array.isArray(value) ? value : [];
    const seenIds = new Set();
    return source.slice(0, SPARK_QUESTION_LIMIT).map((question, index) => {
        const type = question?.type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
            ? SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
            : SPARK_QUESTION_TYPES.SHORT_TEXT;
        let id = String(question?.id || `q${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '-');
        if (!id || seenIds.has(id)) id = `q${index + 1}`;
        seenIds.add(id);
        const rawOptions = type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
            ? (Array.isArray(question?.options) ? question.options : [])
                .slice(0, 4)
                .map((option, originalIndex) => ({ originalIndex, text: String(option || '').trim() }))
                .filter(option => option.text)
            : [];
        const options = rawOptions.map(option => option.text);
        const requestedCorrectOption = Number(question?.correctOption);
        const correctOption = rawOptions.findIndex(option => option.originalIndex === requestedCorrectOption);
        return {
            id,
            type,
            prompt: String(question?.prompt || '').trim(),
            options,
            correctOption: type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE
                && Number.isInteger(correctOption)
                && correctOption >= 0
                && correctOption < options.length
                ? correctOption
                : 0
        };
    }).filter(question => question.prompt);
}

export function getSparkQuestionsForGrade(spark = {}, grade = '') {
    if (normalizeSparkCheckMode(spark.checkMode ?? spark.check_mode) === SPARK_CHECK_MODES.READING_ONLY) {
        return [];
    }
    const questions = normalizeSparkQuestions(spark.questions);
    if (questions.length > 0) return questions;

    const gradeKey = String(grade || '').match(/\d+/)?.[0] || '';
    const gradeQuestions = spark.gradeQuestions && typeof spark.gradeQuestions === 'object'
        ? spark.gradeQuestions
        : (spark.grade_questions && typeof spark.grade_questions === 'object' ? spark.grade_questions : {});
    const prompt = String(gradeQuestions[gradeKey] || spark.question || '').trim();
    return prompt ? [{
        id: 'legacy-question',
        type: SPARK_QUESTION_TYPES.SHORT_TEXT,
        prompt,
        options: [],
        correctOption: 0
    }] : [];
}

export function evaluateSparkAnswers(questions = [], answers = {}) {
    const normalizedAnswers = answers && typeof answers === 'object' ? answers : {};
    const results = questions.map(question => {
        const answer = normalizedAnswers[question.id];
        if (question.type === SPARK_QUESTION_TYPES.MULTIPLE_CHOICE) {
            const selected = Number(answer);
            const hasAnswer = answer !== '' && answer !== null && answer !== undefined;
            const answered = hasAnswer && Number.isInteger(selected) && selected >= 0 && selected < question.options.length;
            return { id: question.id, answered, correct: answered && selected === question.correctOption };
        }
        const text = String(answer || '').trim();
        const answered = text.length >= SPARK_RESPONSE_MIN_LENGTH;
        return { id: question.id, answered, correct: answered };
    });
    const answered = results.filter(result => result.answered).length;
    const correct = results.filter(result => result.correct).length;
    return {
        total: questions.length,
        answered,
        correct,
        isComplete: questions.length > 0 && correct === questions.length,
        results
    };
}
