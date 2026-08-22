export function getDateValueInTimeZone(date = new Date(), timeZone = 'UTC') {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const valueByType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
}

export function getPanamaDateValue(date = new Date()) {
    return getDateValueInTimeZone(date, 'America/Panama');
}

export function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.toMillis === 'function') return new Date(value.toMillis());
    if (value.seconds !== undefined) return new Date(Number(value.seconds) * 1000);
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function timestampMillis(value) {
    return toDate(value)?.getTime() || 0;
}
