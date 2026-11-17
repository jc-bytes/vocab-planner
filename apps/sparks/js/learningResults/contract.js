export const CONTRACT_VERSION = 'learning-results-v1';
export const ACTIVITIES = Object.freeze(['flashcards', 'matching', 'scramble', 'wordle', 'hangman', 'fill-in-blank', 'crossword', 'word-search', 'quiz', 'synonym-antonym', 'speed-match', 'reading-check']);
export const LIMITS = Object.freeze({ words: 200, appearances: 20, opportunities: 250, events: 50000, request: 262144, evidence: 8388608, event: 16384, state: 65536, terminal: 16384 });
const encoder = new TextEncoder();
export function fail(code, field = '', message = code) { const error = new Error(message); error.code = code; error.field = field; throw error; }
export function integer(value, min = 0, max = Number.MAX_SAFE_INTEGER, field = '') {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail('INVALID_INTEGER', field);
    return value;
}
export function uuid(value, field = 'id') {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) fail('INVALID_UUID', field);
    return value;
}
export function byteOrder(a, b) {
    const left = encoder.encode(a), right = encoder.encode(b);
    for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i] - right[i];
    return left.length - right.length;
}
function quote(value) {
    let result = '"';
    for (const char of value) {
        const cp = char.codePointAt(0);
        if (cp === 0 || cp >= 0xd800 && cp <= 0xdfff) fail('INVALID_UNICODE');
        result += cp < 32 ? `\\u${cp.toString(16).padStart(4, '0')}` : char === '"' || char === '\\' ? `\\${char}` : char;
    }
    return `${result}"`;
}
export function canonical(value) {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(integer(value, -Number.MAX_SAFE_INTEGER));
    if (typeof value === 'string') return quote(value);
    if (Array.isArray(value)) return `[${Array.from(value, canonical).join(',')}]`;
    if (value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
        return `{${Object.keys(value).sort(byteOrder).map(key => `${quote(key)}:${canonical(value[key])}`).join(',')}}`;
    }
    return fail('INVALID_JSON');
}
export function bytes(value) { return encoder.encode(canonical(value)); }
export function byteLength(value) { return bytes(value).length; }
export async function sha256(data) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', typeof data === 'string' ? encoder.encode(data) : data);
    return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
}
export function unhex(hash) {
    if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) fail('INVALID_HASH');
    return Uint8Array.from(hash.match(/../g), n => parseInt(n, 16));
}
export async function initialHash(attemptId, taskId) { return sha256(bytes({ contractVersion: CONTRACT_VERSION, attemptId: uuid(attemptId), taskId: uuid(taskId) })); }
export function frame(event) {
    const body = bytes(event);
    if (body.length > LIMITS.event) fail('EVIDENCE_LIMIT', 'event');
    const framed = new Uint8Array(body.length + 4);
    new DataView(framed.buffer).setUint32(0, body.length, false); framed.set(body, 4);
    return framed;
}
export async function extendHash(hash, events) {
    for (const event of events) {
        const framed = frame(event), joined = new Uint8Array(32 + framed.length);
        joined.set(unhex(hash)); joined.set(framed, 32); hash = await sha256(joined);
    }
    return hash;
}
export function rpcArguments(operationId, payload, limit = LIMITS.request, ownerUserId = null) {
    const args = { p_operation_id: uuid(operationId), p_payload: canonical(payload), ...(ownerUserId ? {p_expected_user_id:ownerUserId} : {}) };
    if (byteLength(args) > limit) fail('EVIDENCE_LIMIT', 'request');
    return args;
}
export function assertKeys(value, required, optional = []) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_OBJECT');
    for (const field of required) if (!Object.hasOwn(value, field)) fail('MISSING_FIELD', field);
    for (const field of Object.keys(value)) if (!required.includes(field) && !optional.includes(field)) fail('UNKNOWN_FIELD', field);
}
