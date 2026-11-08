import { getStudentActivity } from './student/studentActivityRegistry.js';
import { weeklyWordPlayable, activityHasPlayableRound } from './student/weeklyVocabularyPolicy.js';
export function vocabularyPublicationErrors(content = {}) {
    const settings = content.activitySettings || {}, required = settings.requiredActivities, extras = settings.additionalActivities === undefined ? [] : settings.additionalActivities;
    if (!Array.isArray(required)) return ['Choose Flashcards and at least one other required activity.'];
    const errors = [];
    if (required.length < 2 || required[0] !== 'flashcards') errors.push('Require Flashcards first and at least one other activity.');
    if (new Set(required).size !== required.length) errors.push('Required activities must be distinct.');
    if (!Array.isArray(extras)) errors.push('Optional activities must be a list.');
    else if (new Set(extras).size !== extras.length) errors.push('Optional activities must be distinct.');
    for (const id of required) {
        const activity = getStudentActivity(id);
        if (!activity) errors.push('Unknown required activity.');
        else if (!activityHasPlayableRound(id, content, (Array.isArray(content.words) ? content.words : []).filter(word => weeklyWordPlayable(id, word, content, activity.isPlayable)).length)) errors.push(`Not enough playable words for ${id}.`);
        if (Array.isArray(extras) && extras.includes(id)) errors.push('An activity cannot be both required and optional.');
    }
    if (Array.isArray(extras) && extras.some(id => !getStudentActivity(id))) errors.push('Unknown optional activity.');
    if (settings.retiredWeeklySet) errors.push('Retired vocabulary cannot be published.');
    return errors;
}
