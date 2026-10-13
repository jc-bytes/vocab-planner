import { getActivityLabel } from './activityMetadata.js';

function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function timestampValue(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (Number.isFinite(value.seconds)) return value.seconds * 1000;
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function readableUnitName(unitKey, unit = {}) {
    const explicit = String(unit.unitName || '').trim();
    if (explicit) return explicit;
    return String(unitKey || 'Vocabulary set')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function studentName(profile = {}) {
    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
    return fullName || String(profile.name || 'Unknown student');
}

function activityStatus({ complete, score, plays }) {
    if (complete) return 'Completed';
    if ((score ?? 0) > 0 || plays > 0) return 'In progress';
    return 'Not started';
}

function buildActivity(unitKey, unit, activityType, progress) {
    const latestAttempt = progress?.latestAttempt || null;
    const bestAttempt = progress?.bestAttempt || null;
    const bestScore = numberOrNull(bestAttempt?.score ?? progress?.score);
    const latestScore = numberOrNull(latestAttempt?.score);
    const accuracy = numberOrNull(
        progress?.bestAccuracy ?? progress?.accuracy ?? latestAttempt?.accuracy ?? bestAttempt?.accuracy
    );
    const finishedRuns = Math.max(0, numberOrNull(progress?.finishedRuns) ?? numberOrNull(progress?.plays) ?? 0);
    const masteredRuns = Math.max(0, numberOrNull(progress?.masteredRuns) ?? 0);
    const complete = progress?.isComplete === true;
    const lastPlayed = timestampValue(progress?.lastPlayed || progress?.updatedAt || latestAttempt?.completedAt);
    const activeSeconds = numberOrNull(latestAttempt?.activeSeconds);
    const timeLimitSeconds = numberOrNull(latestAttempt?.timeLimitSeconds);
    const wasLate = latestAttempt?.wasLate === true || latestAttempt?.isLate === true;
    const excused = wasLate && latestAttempt?.lateOverride === true;

    return Object.freeze({
        unitKey,
        unitName: readableUnitName(unitKey, unit),
        activityType,
        activityName: getActivityLabel(activityType),
        score: bestScore,
        bestScore,
        latestScore,
        latestAccuracy: numberOrNull(latestAttempt?.accuracy),
        accuracy,
        lifetimeCorrect: Math.max(0, numberOrNull(progress?.lifetimeCorrect) ?? 0),
        lifetimeAttempted: Math.max(0, numberOrNull(progress?.lifetimeAttempted) ?? 0),
        finishedRuns,
        masteredRuns,
        plays: finishedRuns,
        complete,
        status: activityStatus({ complete, score: bestScore, plays: finishedRuns }),
        verified: progress?.verified === true,
        lastPlayed,
        activeSeconds,
        timeLimitSeconds,
        wasLate,
        isLate: latestAttempt?.isLate === true,
        excused,
        lateReason: String(latestAttempt?.lateOverrideReason || ''),
        attemptId: String(latestAttempt?.attemptId || progress?.latestAttemptId || ''),
        totalEarned: numberOrNull(progress?.totalEarned) ?? 0
    });
}

function average(values) {
    const usable = values.filter(value => Number.isFinite(value));
    return usable.length
        ? Math.round(usable.reduce((total, value) => total + value, 0) / usable.length)
        : null;
}

export function buildStudentProfileModel(student, { now = Date.now() } = {}) {
    if (!student?.id && !student?.userId) {
        throw new TypeError('A student ID is required to build a teacher profile.');
    }

    const profile = student.studentProfile || {};
    const activities = [];
    const units = Object.entries(student.units || {}).map(([unitKey, unit = {}]) => {
        const unitActivities = Object.entries(unit.scores || {}).map(([activityType, progress]) =>
            buildActivity(unitKey, unit, activityType, progress || {})
        );
        activities.push(...unitActivities);
        const completed = unitActivities.filter(activity => activity.complete).length;
        return Object.freeze({
            key: unitKey,
            name: readableUnitName(unitKey, unit),
            subject: String(unit.subjectSlug || ''),
            trimester: String(unit.trimester || ''),
            grade: String(unit.grade || profile.grade || ''),
            completed,
            total: unitActivities.length,
            percent: unitActivities.length ? Math.round((completed / unitActivities.length) * 100) : 0
        });
    });

    activities.sort((left, right) => right.lastPlayed - left.lastPlayed || left.unitName.localeCompare(right.unitName));
    units.sort((left, right) => left.name.localeCompare(right.name));

    const completed = activities.filter(activity => activity.complete).length;
    const inProgress = activities.filter(activity => activity.status === 'In progress').length;
    const late = activities.filter(activity => activity.isLate).length;
    const lastActivity = activities.reduce((latest, activity) => Math.max(latest, activity.lastPlayed), 0);
    const lastActive = lastActivity;
    const inactiveDays = lastActive ? Math.max(0, Math.floor((now - lastActive) / 86_400_000)) : null;
    const attention = [];
    if (activities.length === 0) attention.push('No activity has been recorded yet.');
    if (late > 0) attention.push(`${late} latest recorded ${late === 1 ? 'run is' : 'runs are'} marked late.`);
    if (inProgress > 0) attention.push(`${inProgress} recorded ${inProgress === 1 ? 'activity is' : 'activities are'} not complete.`);

    const lifetimeCorrect = activities.reduce((total, activity) => total + activity.lifetimeCorrect, 0);
    const lifetimeAttempted = activities.reduce((total, activity) => total + activity.lifetimeAttempted, 0);
    const weightedAccuracy = lifetimeAttempted > 0
        ? Math.round((lifetimeCorrect / lifetimeAttempted) * 100)
        : average(activities.map(activity => activity.accuracy));

    const coinHistory = [...(student.coinHistory || [])]
        .map(entry => Object.freeze({
            id: String(entry.id || ''),
            type: String(entry.type || ''),
            amount: numberOrNull(entry.amount) ?? 0,
            source: String(entry.source || ''),
            description: String(entry.description || ''),
            timestamp: timestampValue(entry.timestamp)
        }))
        .sort((left, right) => right.timestamp - left.timestamp);

    return Object.freeze({
        id: String(student.id || student.userId),
        name: studentName(profile),
        email: String(student.email || profile.email || ''),
        grade: String(profile.grade || ''),
        section: String(profile.group || ''),
        coins: numberOrNull(student.coins) ?? 0,
        totalXp: numberOrNull(student.totalXp) ?? 0,
        mustChangePassword: typeof student.mustChangePassword === 'boolean' ? student.mustChangePassword : null,
        lastActive,
        inactiveDays,
        summary: Object.freeze({
            completed,
            recorded: activities.length,
            inProgress,
            late,
            averageBestScore: average(activities.filter(activity => activity.complete).map(activity => activity.bestScore)),
            averageAccuracy: weightedAccuracy
        }),
        attention: Object.freeze(attention),
        units: Object.freeze(units),
        activities: Object.freeze(activities),
        coinHistory: Object.freeze(coinHistory)
    });
}

export function teacherActivityLabel(activityType) {
    return getActivityLabel(activityType);
}
