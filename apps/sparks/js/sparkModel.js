import {
    normalizeSparkCheckMode,
    normalizeSparkQuestions
} from './sparkCheckModel.js';

export const SPARK_GRADE_LEVELS = Object.freeze(['6', '7', '8', '9']);
const SPARK_TYPES = new Set(['cool_fact', 'trivia', 'good_news', 'reflection', 'debate']);
const SPARK_STATUSES = new Set(['draft', 'scheduled', 'archived']);

export function normalizeSparkDate(value) {
    const text = String(value || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

export function normalizeSparkGradeQuestions(value) {
    const source = value && typeof value === 'object' ? value : {};
    return SPARK_GRADE_LEVELS.reduce((questions, grade) => {
        const text = String(source[grade] ?? source[`grade${grade}`] ?? '').trim();
        if (text) questions[grade] = text;
        return questions;
    }, {});
}

export function normalizeSparkTargetGrades(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(',');
    const grades = source
        .flatMap(item => String(item || '').split(','))
        .map(item => item.trim().match(/\d+/)?.[0] || '')
        .filter(grade => SPARK_GRADE_LEVELS.includes(grade));
    return Array.from(new Set(grades));
}

export function isAllGradeSpark(spark) {
    const targetGrades = normalizeSparkTargetGrades(spark?.targetGrades ?? spark?.target_grades);
    return SPARK_GRADE_LEVELS.every(grade => targetGrades.includes(grade));
}

export function normalizeSparkRecord(value = {}, { defaultSubjectSlug = 'technology' } = {}) {
    const source = value && typeof value === 'object' ? value : {};
    const requestedType = source.sparkType || source.spark_type;
    const status = SPARK_STATUSES.has(source.status) ? source.status : 'draft';
    return {
        id: String(source.id || ''),
        sparkType: SPARK_TYPES.has(requestedType) ? requestedType : 'cool_fact',
        title: String(source.title || '').trim(),
        sparkText: String(source.sparkText ?? source.spark_text ?? '').trim(),
        whyItMatters: String(source.whyItMatters ?? source.why_it_matters ?? '').trim(),
        question: String(source.question || '').trim(),
        gradeQuestions: normalizeSparkGradeQuestions(source.gradeQuestions ?? source.grade_questions),
        checkMode: normalizeSparkCheckMode(source.checkMode ?? source.check_mode),
        questions: normalizeSparkQuestions(source.questions),
        targetGrades: normalizeSparkTargetGrades(
            source.targetGrades ?? source.target_grades ?? SPARK_GRADE_LEVELS
        ),
        sourceTitle: String(source.sourceTitle ?? source.source_title ?? '').trim(),
        sourceUrl: String(source.sourceUrl ?? source.source_url ?? '').trim(),
        subjectSlug: String(source.subjectSlug ?? source.subject_slug ?? defaultSubjectSlug).trim() || defaultSubjectSlug,
        scheduledDate: normalizeSparkDate(source.scheduledDate ?? source.scheduled_date),
        status,
        ownerId: source.ownerId || source.owner_id || null,
        createdAt: source.createdAt || source.created_at || null,
        updatedAt: source.updatedAt || source.updated_at || null
    };
}
