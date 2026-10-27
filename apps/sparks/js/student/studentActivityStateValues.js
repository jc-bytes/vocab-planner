const MAX_ACTIVITY_STATE_BYTES = 50 * 1024;

export function sanitizeActivityState(stateData) {
    if (stateData === null) return null;
    try {
        const serialized = JSON.stringify(stateData);
        if (/data:image\/|base64/i.test(serialized)) {
            console.warn('Rejected activity state because it contains image data.');
            return undefined;
        }
        const byteLength = new TextEncoder().encode(serialized).length;
        if (byteLength > MAX_ACTIVITY_STATE_BYTES) {
            console.warn(`Rejected activity state above 50 KB (${byteLength} bytes).`);
            return undefined;
        }
        return JSON.parse(serialized);
    } catch (error) {
        console.warn('Rejected invalid activity state:', error);
        return undefined;
    }
}

export function areActivityStatesEquivalent(firstState, secondState) {
    if (firstState === secondState) return true;
    if (!firstState || !secondState || typeof firstState !== 'object' || typeof secondState !== 'object') return false;
    const canonicalize = value => {
        if (Array.isArray(value)) return value.map(canonicalize);
        if (!value || typeof value !== 'object') return value;
        return Object.keys(value).filter(key => key !== 'updatedAt').sort().reduce((result, key) => {
            result[key] = canonicalize(value[key]);
            return result;
        }, {});
    };
    try { return JSON.stringify(canonicalize(firstState)) === JSON.stringify(canonicalize(secondState)); }
    catch { return false; }
}
