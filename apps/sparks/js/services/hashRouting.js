export function decodeHashPart(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function parseHashLocation(hash = window.location.hash) {
    const rawHash = String(hash || '');
    if (!rawHash || rawHash === '#') return null;

    const routeText = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
    const queryStart = routeText.indexOf('?');
    const rawPath = queryStart === -1 ? routeText : routeText.slice(0, queryStart);
    const rawQuery = queryStart === -1 ? '' : routeText.slice(queryStart + 1);
    const path = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;

    return {
        parts: path.split('/').filter(Boolean).map(decodeHashPart),
        params: new URLSearchParams(rawQuery)
    };
}

export function writeHashLocation(hash, { replace = false } = {}) {
    if (window.location.hash === hash) return false;

    const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
    window.history[replace ? 'replaceState' : 'pushState'](null, '', nextUrl);
    return true;
}
