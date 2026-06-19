export const XP_PER_COMPLETED_ACTIVITY = 20;
export const XP_PER_LEVEL = 100;

export function getStudentExperience(progressData = {}) {
    const completedActivities = new Set();
    const units = progressData?.units && typeof progressData.units === 'object'
        ? progressData.units
        : {};

    Object.entries(units).forEach(([unitKey, unitProgress]) => {
        if (!unitProgress || typeof unitProgress !== 'object') return;
        const unitId = String(unitProgress.unitId || unitProgress.unitName || unitKey);
        const scores = unitProgress.scores && typeof unitProgress.scores === 'object'
            ? unitProgress.scores
            : {};

        Object.entries(scores).forEach(([activityType, scoreData]) => {
            if (!scoreData || typeof scoreData !== 'object') return;
            if (scoreData.isComplete === true || Number(scoreData.score) >= 100) {
                completedActivities.add(`${unitId}:${activityType}`);
            }
        });
    });

    const completedCount = completedActivities.size;
    const totalXp = completedCount * XP_PER_COMPLETED_ACTIVITY;
    const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
    const xpIntoLevel = totalXp % XP_PER_LEVEL;

    return {
        completedCount,
        totalXp,
        level,
        xpIntoLevel,
        xpPerLevel: XP_PER_LEVEL,
        xpToNextLevel: XP_PER_LEVEL - xpIntoLevel
    };
}
