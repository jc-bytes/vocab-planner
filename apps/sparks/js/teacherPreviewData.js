/** Copy library data into the embedded screen without repository timestamp methods. */
export function cloneTeacherPreviewData(data) {
    return JSON.parse(JSON.stringify(data, (_key, value) => {
        // Repository timestamps carry a toDate closure, which structuredClone and
        // postMessage cannot transfer. Only the date value belongs in a preview.
        if (value && typeof value.toDate === 'function' && value.seconds !== undefined) {
            return value.toDate().toISOString();
        }
        if (typeof value === 'function') throw new TypeError('Preview data must not contain functions.');
        return value;
    }));
}
