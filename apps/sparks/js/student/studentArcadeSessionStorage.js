import { MAX_QUEUED_ARCADE_SECONDS } from './studentArcadePolicy.js';

const SESSION_STORAGE_PREFIX = 'student_arcade_session_v2:';
const LEGACY_SESSION_STORAGE_PREFIX = 'student_arcade_session_v1:';

function sessionKey(studentId) {
    return `${SESSION_STORAGE_PREFIX}${String(studentId || 'local-dev')}`;
}

function normalizeSession(saved = {}) {
    const pending = saved.pendingPurchase;
    const pendingPurchase = pending && typeof pending.eventId === 'string'
        && pending.eventId.length >= 8 && pending.eventId.length <= 240
        && typeof pending.gameId === 'string' && pending.gameId.length > 0 && pending.gameId.length <= 120
        && typeof pending.clientId === 'string' && pending.clientId.length <= 512
        ? { eventId: pending.eventId, gameId: pending.gameId, clientId: pending.clientId } : null;
    return {
        remainingSeconds: Math.min(MAX_QUEUED_ARCADE_SECONDS, Math.max(0, Math.floor(Number(saved.remainingSeconds) || 0))),
        gameId: String(saved.gameId || '').slice(0, 120),
        pendingPurchase,
        lastAppliedEventId: String(saved.lastAppliedEventId || '').slice(0, 240),
        updatedAt: saved.updatedAt || ''
    };
}

function sessionStorageError(cause) {
    const error = new Error('Arcade could not safely read or save its purchase receipt. Check browser storage and try again.', { cause });
    error.code = 'ARCADE_STORAGE_UNAVAILABLE';
    return error;
}

function validateSession(saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)
        || !Number.isFinite(saved.remainingSeconds) || saved.remainingSeconds < 0
        || saved.remainingSeconds > MAX_QUEUED_ARCADE_SECONDS
        || (saved.pendingPurchase != null && !normalizeSession(saved).pendingPurchase)) {
        throw new Error('The saved Arcade purchase record is invalid.');
    }
    return normalizeSession(saved);
}

export function readLocalArcadeSession(studentId, { strict = false } = {}) {
    try {
        const raw = localStorage.getItem(sessionKey(studentId));
        if (raw !== null) return validateSession(JSON.parse(raw));
        const legacy = localStorage.getItem(`${LEGACY_SESSION_STORAGE_PREFIX}${String(studentId || 'local-dev')}`);
        if (legacy === null) return normalizeSession();
        const session = normalizeSession({ ...JSON.parse(legacy), pendingPurchase: null, lastAppliedEventId: '' });
        // Copy paid time once. Old-release tabs can keep writing v1 without
        // replacing v2 receipts or resurrecting time after the v2 timer drains.
        localStorage.setItem(sessionKey(studentId), JSON.stringify(session));
        return session;
    } catch (cause) {
        if (strict) throw sessionStorageError(cause);
        return normalizeSession();
    }
}

export function writeLocalArcadeSession(studentId, value = {}, { strict = false, expectedLastAppliedEventId } = {}) {
    try {
        const previous = readLocalArcadeSession(studentId, { strict: true });
        if (expectedLastAppliedEventId !== undefined && previous.lastAppliedEventId !== expectedLastAppliedEventId) return previous;
        const session = normalizeSession({ ...previous, ...value, updatedAt: new Date().toISOString() });
        // Keep zero-time records as migration tombstones and receipt markers.
        localStorage.setItem(sessionKey(studentId), JSON.stringify(session));
        return session;
    } catch (cause) {
        if (strict) throw sessionStorageError(cause);
        // Preserve an unreadable receipt rather than replacing uncertain work.
        return null;
    }
}
