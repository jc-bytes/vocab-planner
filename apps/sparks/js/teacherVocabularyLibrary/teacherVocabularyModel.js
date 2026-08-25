import { getVocabSubjectSlug } from '../services/vocabularyApi.js';

export function filterTeacherVocabularyItems(items, drilldown = {}, {
    getGrades,
    getTrimesterKey,
    getMonthKey
}) {
    const subject = drilldown.subject || null;
    const grade = drilldown.grade || null;
    const trimester = drilldown.trimester || null;
    const month = drilldown.month || null;

    return (items || []).filter(({ vocab }) => {
        if (subject && getVocabSubjectSlug(vocab) !== subject) return false;
        if (grade && !getGrades(vocab).includes(grade)) return false;
        if (trimester && getTrimesterKey(vocab) !== trimester) return false;
        if (month && getMonthKey(vocab) !== month) return false;
        return true;
    });
}
