// A score describes performance. Only the verified completion flag finishes required work.
export function verifiedActivityComplete(progress) {
    return progress?.verified === true && (progress.complete === true || progress.is_complete === true || progress.isComplete === true);
}

export function vocabularyRequirements(content) {
    const required = content?.activitySettings?.requiredActivities;
    return Array.isArray(required) && required.every(type => typeof type === 'string' && type.trim())
        ? [...new Set(required)] : null;
}
