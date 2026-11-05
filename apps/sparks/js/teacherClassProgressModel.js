import { parseUtcDateOnly } from './services/dateOnly.js';

const termKeys = ['IT', 'IIT', 'IIIT'];
export function schoolDay(value, timeZone = 'UTC') {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-');
}
export function progressTerms(calendar, year) {
    const source = String(calendar?.schoolYear) === String(year) ? calendar : calendar?.academicYears?.[String(year)];
    return termKeys.map((key, index) => ({ period: String(index + 1), from: source?.trimesters?.[key]?.startDate || '', to: source?.trimesters?.[key]?.endDate || '' }))
        .filter(range => parseUtcDateOnly(range.from) && parseUtcDateOnly(range.to) && range.from <= range.to);
}
export function defaultProgressPeriod(calendar, year, timeZone, now = Date.now()) {
    const terms = progressTerms(calendar, year), today = schoolDay(now, timeZone);
    const current = terms.find(term => term.from <= today && term.to >= today);
    return current || [...terms].reverse().find(term => term.from <= today) || terms[0] || { period: 'custom', from: '', to: '' };
}
export function normalizeProgressContext(value = {}) {
    const context = {
        period: ['1', '2', '3', 'custom'].includes(value.period) ? value.period : 'custom',
        from: parseUtcDateOnly(value.from) ? value.from : '', to: parseUtcDateOnly(value.to) ? value.to : '',
        search: String(value.search || '').slice(0, 200),
        sort: ['name', 'completion-asc', 'completion-desc'].includes(value.sort) ? value.sort : 'name',
        unfinished: value.unfinished === true,
        offset: Math.max(0, Math.min(100000, Math.floor(Number(value.offset) || 0))),
        scroll: Math.max(0, Math.min(1000000, Number(value.scroll) || 0))
    };
    return context;
}
export function validProgressRange(context) {
    return Boolean(parseUtcDateOnly(context?.from) && parseUtcDateOnly(context?.to) && context.from <= context.to);
}
export function assignmentInProgressPeriod(assignment, context, timeZone) {
    if (!validProgressRange(context)) return false;
    const day = schoolDay(assignment.releaseAt ?? assignment.release_at, timeZone);
    return Boolean(day && day >= context.from && day <= context.to);
}
export function progressPresentation(summary) {
    if (!summary || summary.unknown > 0) return { percent: null, band: 'unknown', label: 'Progress unavailable' };
    if (!summary.required) return { percent: null, band: 'empty', label: 'No required work' };
    const fraction = Math.max(0, Math.min(100, 100 * summary.completed / summary.required));
    // Do not round unfinished work up to 100% or into the next color band.
    const percent = Math.floor(fraction);
    return { percent, band: String(Math.min(4, Math.floor(fraction / 20))), label: summary.completed === summary.required ? 'Complete' : `${percent}%` };
}
export function readProgressContext(params) {
    if (params.get('display') !== 'progress') return {};
    return { progressContext: normalizeProgressContext({ period: params.get('period'), from: params.get('from'), to: params.get('to'),
        search: params.get('search'), sort: params.get('sort'), unfinished: params.get('unfinished') === '1', offset: params.get('offset'), scroll: params.get('scroll') }) };
}
export function writeProgressContext(params, context) {
    if (!context) return;
    const state = normalizeProgressContext(context);
    params.set('display', 'progress');
    for (const key of ['period', 'from', 'to', 'search', 'sort']) if (state[key]) params.set(key, state[key]);
    if (state.unfinished) params.set('unfinished', '1');
    if (state.offset) params.set('offset', String(state.offset));
    if (state.scroll) params.set('scroll', String(state.scroll));
}
