import { ACTIVITY_DEFINITIONS } from './activityMetadata.js';

const activityIds = new Set(ACTIVITY_DEFINITIONS.map(activity => activity.id));
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const defaults = Object.freeze({ enabled: false, maxPoints: 100, bonusPerActivity: 0, bonusCap: null, capAtMaxPoints: false });

export function normalizeVocabularyGrading(value) {
    if (value === undefined || value === null) return { ...defaults };
    if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Grading settings must be an object.');
    const config = { ...defaults };
    for (const key of ['enabled', 'capAtMaxPoints']) {
        if (value[key] === undefined) continue;
        if (typeof value[key] !== 'boolean') throw new TypeError(`${key} must be true or false.`);
        config[key] = value[key];
    }
    for (const key of ['maxPoints', 'bonusPerActivity', 'bonusCap']) {
        if (value[key] === undefined) continue;
        if (key === 'bonusCap' && value[key] === null) { config[key] = null; continue; }
        const number = value[key];
        if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > 100000 || (key === 'maxPoints' && number === 0)
            || Math.abs(number * 100 - Math.round(number * 100)) > 0.000001) {
            throw new TypeError(`${key} must be ${key === 'maxPoints' ? 'greater than zero' : 'zero or greater'}, at most 100000, with up to two decimal places.`);
        }
        config[key] = number;
    }
    return config;
}

// This pure calculation supports policy verification. The gradebook and student
// display read authoritative server results; they never award from local scores.
export function calculateVocabularyGrade(assignment, override) {
    const settings = assignment.content?.activitySettings || assignment.activitySettings || {};
    const empty = { assignmentId: assignment.id || assignment.assignmentId, enabled: false, status: 'ungraded', requiredCount: 0, requiredCompleted: 0,
        additionalCount: 0, additionalCompleted: 0, basePoints: null, bonusPoints: null, earnedPoints: null, maxPoints: null, percent: null, activities: [] };
    let config;
    try { config = normalizeVocabularyGrading(override ?? assignment.grading ?? settings.grading); }
    catch { return { ...empty, enabled: true, status: 'unavailable', reason: 'Invalid grading settings.' }; }
    if (!config.enabled) return empty;
    const required = [...new Set(Array.isArray(settings.requiredActivities) ? settings.requiredActivities : [])];
    const additional = [...new Set(Array.isArray(settings.additionalActivities) ? settings.additionalActivities : [])].filter(id => activityIds.has(id) && !required.includes(id));
    const unavailable = { ...empty, enabled: true, status: 'unavailable', maxPoints: config.maxPoints };
    if (!required.length || required.some(id => !activityIds.has(id))) {
        return { ...unavailable, reason: 'Required or additional activities are unavailable.' };
    }
    const reviewOnly = settings.weeklyPoolVersion === 1 && settings.reviewOnly === true;
    if (settings.retiredWeeklySet || reviewOnly === required.includes('flashcards')) {
        return { ...unavailable, reason: 'Required activities do not match the assigned activity path.' };
    }
    if (assignment.blockedActivities?.length) return { ...unavailable, reason: 'A required activity cannot be completed.', blockedActivities: assignment.blockedActivities };
    const progress = new Map((assignment.progress || []).map(result => [result.activity_type ?? result.activityType, result]));
    const completed = id => {
        const result = progress.get(id);
        return result?.verified === true && (result.is_complete === true || result.isComplete === true || Number(result.score) >= 100);
    };
    const requiredCompleted = required.filter(completed).length, additionalCompleted = additional.filter(completed).length;
    const basePoints = round(config.maxPoints * requiredCompleted / required.length);
    const rawBonusPoints = round(config.bonusPerActivity * additionalCompleted);
    const bonusPoints = round(Math.min(config.bonusCap ?? Infinity, rawBonusPoints, config.capAtMaxPoints ? Math.max(0, config.maxPoints - basePoints) : Infinity));
    const earnedPoints = round(basePoints + bonusPoints);
    return { ...empty, enabled: true, status: 'provisional', requiredCount: required.length, requiredCompleted, additionalCount: additional.length, additionalCompleted,
        basePoints, bonusPoints, rawBonusPoints, bonusLimited: bonusPoints < rawBonusPoints, earnedPoints, maxPoints: config.maxPoints, percent: round(100 * earnedPoints / config.maxPoints),
        activities: [...required.map(activityType => ({ activityType, required: true, complete: completed(activityType), points: completed(activityType) ? round(config.maxPoints / required.length) : 0 })),
            ...additional.map(activityType => ({ activityType, required: false, complete: completed(activityType), points: completed(activityType) ? config.bonusPerActivity : 0 }))] };
}

export function formatVocabularyGrade(grade) {
    if (!grade || grade.status === 'unavailable') return 'Unavailable';
    if (!grade.enabled || grade.status === 'ungraded') return 'Not graded';
    if (!Number.isFinite(grade.earnedPoints) || !Number.isFinite(grade.maxPoints) || grade.maxPoints <= 0) return 'Unavailable';
    return `${grade.earnedPoints} / ${grade.maxPoints} points`;
}

export function summarizeVocabularyGrades(grades) {
    const enabled = grades.filter(grade => grade?.enabled && grade.status !== 'ungraded');
    const measurable = enabled.filter(grade => grade.status !== 'unavailable' && Number.isFinite(grade.earnedPoints) && Number.isFinite(grade.maxPoints) && grade.maxPoints > 0);
    const earnedPoints = round(measurable.reduce((sum, grade) => sum + grade.earnedPoints, 0)), maxPoints = round(measurable.reduce((sum, grade) => sum + grade.maxPoints, 0));
    return { earnedPoints: measurable.length ? earnedPoints : null, maxPoints: measurable.length ? maxPoints : null,
        percent: maxPoints ? round(100 * earnedPoints / maxPoints) : null, graded: measurable.length, unavailable: enabled.length - measurable.length,
        provisional: enabled.some(grade => grade.status === 'provisional' || !grade.published) };
}
