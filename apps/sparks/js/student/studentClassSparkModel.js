import { calculateVocabularyPlacement } from '../services/schoolCalendar.js';
import { getPanamaDateValue } from '../services/dateUtils.js';

export function getAutomaticClassSparkLocation(items, calendar, now = new Date()) {
    const today = getPanamaDateValue(now);
    const placement = calculateVocabularyPlacement(today, calendar);
    const current = items.find(item => item.trimester === placement?.trimester && item.month === placement?.month);
    const monthIndex = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
    const candidates = items.filter(item => item.month !== 'other' && item.trimester !== 'other');
    candidates.sort((a, b) => Math.abs(monthIndex(a.date) - monthIndex(today)) - Math.abs(monthIndex(b.date) - monthIndex(today))
        || a.date.localeCompare(b.date));
    const selected = current || candidates[0];
    return selected ? { trimester: selected.trimester, month: selected.month } : null;
}

export function getReleasedClassSparks(assignments, calendar, now = Date.now()) {
    return assignments.filter(item => item.kind === 'spark' && !item.withdrawn && Date.parse(item.release_at) <= now)
        .map(item => {
            const date = getPanamaDateValue(new Date(item.release_at));
            const placement = calculateVocabularyPlacement(date, calendar);
            return { ...item, date, trimester: placement?.trimester || 'other', month: placement?.month || 'other',
                closed: Boolean(item.close_at && Date.parse(item.close_at) <= now) };
        }).sort((a,b) => Date.parse(b.release_at) - Date.parse(a.release_at) || String(a.id).localeCompare(String(b.id)));
}

export function selectCurrentClassSpark(assignments, now = Date.now()) {
    return assignments.filter(item => item.kind === 'spark' && !item.withdrawn
        && Date.parse(item.release_at) <= now
        && (!item.close_at || Date.parse(item.close_at) > now))
        .sort((a, b) => Date.parse(b.release_at) - Date.parse(a.release_at) || String(b.id).localeCompare(String(a.id)))[0] || null;
}

export function formatClassSparkHeading(value) {
    const original = String(value || '').trim();
    const match = original.match(/^G(\d{1,2})\s+T([123])\s+W(\d{1,2})\s*[-–—]\s*(.+)$/i);
    if (!match) return { title: original || 'Your Spark', context: '' };
    const [, grade, trimester, week, text] = match;
    const series = text.match(/\s+[-–—]\s+(Words in use(?:\s+\d+)?)$/i);
    const title = series ? text.slice(0, series.index).trim() : text;
    if (!title) return { title: original, context: '' };
    const context = [`Grade ${Number(grade)}`, `Trimester ${trimester}`, `Week ${Number(week)}`];
    if (series) context.push(series[1]);
    return { title, context: context.join(' · ') };
}
