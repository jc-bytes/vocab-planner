export const REQUIRED_ACTIVITY_XP = 50;
export const OPTIONAL_ACTIVITY_XP = 10;
export const FIRST_LEVEL_XP = 100;
export const LEVEL_XP_INCREMENT = 50;

export function getLevelTitle(level) {
    if (level >= 10) return 'Innovator';
    if (level >= 6) return 'Creator';
    if (level >= 3) return 'Builder';
    return 'Explorer';
}

export function getLevelProgress(totalXp = 0) {
    let remainingXp = Math.max(0, Math.floor(Number(totalXp) || 0));
    let level = 1;
    let xpForNextLevel = FIRST_LEVEL_XP;

    while (remainingXp >= xpForNextLevel) {
        remainingXp -= xpForNextLevel;
        level += 1;
        xpForNextLevel += LEVEL_XP_INCREMENT;
    }

    return {
        level,
        title: getLevelTitle(level),
        xpIntoLevel: remainingXp,
        xpForNextLevel,
        xpToNextLevel: xpForNextLevel - remainingXp
    };
}

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
    // Older/offline snapshots have no XP summary, so preserve their original
    // 20-XP-per-completion estimate until Supabase returns the authoritative total.
    const totalXp = Number.isFinite(Number(progressData?.totalXp))
        ? Math.max(0, Math.floor(Number(progressData.totalXp)))
        : completedCount * 20;
    const levelProgress = getLevelProgress(totalXp);

    return {
        completedCount,
        totalXp,
        ...levelProgress,
        xpPerLevel: levelProgress.xpForNextLevel
    };
}
