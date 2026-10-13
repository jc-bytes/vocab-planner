export function parseUtcDateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
    ) return null;
    return date;
}

export function formatUtcDateOnly(date) {
    return date instanceof Date && !Number.isNaN(date.getTime())
        ? date.toISOString().slice(0, 10)
        : '';
}

export function addUtcDateOnlyDays(value, days) {
    const date = value instanceof Date
        ? new Date(value.getTime())
        : parseUtcDateOnly(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return formatUtcDateOnly(date);
}
