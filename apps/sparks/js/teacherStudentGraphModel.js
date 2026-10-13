export function assignmentProgressSeries(model) {
    return model.work.filter(a => a.current && a.known).flatMap(a => {
        const tasks = a.kind === 'spark' ? a.readingRequired ? [{ status: a.readingStatus }] : []
            : a.activities.filter(activity => activity.required);
        if (!tasks.length) return [];
        const completed = tasks.filter(task => task.status === 'Completed').length;
        const review = tasks.filter(task => task.status === 'Needs review').length;
        return [{ id: a.id, title: a.title, total: tasks.length, completed, review, remaining: tasks.length - completed - review }];
    }).slice(0, 5);
}

export function dashboardActivityChoices(model) {
    return model.work.filter(a => a.current && a.kind !== 'spark').flatMap(a => a.activities.map(activity => ({
        key: JSON.stringify([a.id, activity.type]), assignmentId: a.id, title: a.title, type: activity.type,
        recorded: Boolean(activity.progress)
    })));
}

export function activityAccuracySeries(attempts = []) {
    const valid = attempts.filter(a => a.captureQuality === 'complete' && a.finishedAt
        && Number.isFinite(Date.parse(a.finishedAt)) && a.metricLabel?.trim()
        && a.accuracy !== null && a.accuracy !== undefined && a.accuracy !== ''
        && Number.isFinite(Number(a.accuracy)) && Number(a.accuracy) >= 0 && Number(a.accuracy) <= 100)
        .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt));
    const metricLabel = valid[0]?.metricLabel || '';
    return { metricLabel, points: valid.filter(a => a.metricLabel === metricLabel).reverse().map(a => ({
        accuracy: Number(a.accuracy), finishedAt: a.finishedAt, attemptId: a.attemptId
    })) };
}
