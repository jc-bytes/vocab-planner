const terms = [['IT', '1'], ['IIT', '2'], ['IIIT', '3']];
export const assignmentTrimesterOptions = [['all', 'All trimesters'], ['1', 'Trimester 1'], ['2', 'Trimester 2'], ['3', 'Trimester 3'], ['outside', 'Outside trimester dates'], ['unknown', 'Dates not configured']];

export function assignmentTrimester(assignment, calendar, year, timeZone = 'UTC') {
    const academicYear = String(calendar?.schoolYear) === String(year) ? calendar : calendar?.academicYears?.[String(year)];
    if (!academicYear?.trimesters || !assignment.release_at) return 'unknown';
    const date = new Date(assignment.release_at);
    if (!Number.isFinite(date.getTime())) return 'unknown';
    let parts;
    try { parts = new Intl.DateTimeFormat('en-US', {timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date); }
    catch { return 'unknown'; }
    const part = type => parts.find(item => item.type === type)?.value;
    const day = `${part('year')}-${part('month')}-${part('day')}`;
    let complete = true;
    for (const [key, value] of terms) {
        const range = academicYear.trimesters[key];
        if (!range?.startDate || !range?.endDate) { complete = false; continue; }
        if (day >= range.startDate && day <= range.endDate) return value;
    }
    return complete ? 'outside' : 'unknown';
}
export function assignmentTrimesterLabel(value) {
    return ['1','2','3'].includes(value) ? `Trimester ${value}` : value === 'outside' ? 'Outside dates' : 'Not configured';
}
