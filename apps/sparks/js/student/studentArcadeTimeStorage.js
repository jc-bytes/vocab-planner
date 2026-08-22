const STORAGE_KEY = 'student_arcade_time_v1';
const SESSION_STORAGE_PREFIX = 'student_arcade_session_v1:';
const FORMATIVE_PASS_SECONDS = 600;

function normalize(value = {}) {
    return {
        availableSeconds: Math.max(0, Math.floor(Number(value.availableSeconds) || 0)),
        lifetimeEarnedSeconds: Math.max(0, Math.floor(Number(value.lifetimeEarnedSeconds) || 0)),
        lifetimeUsedSeconds: Math.max(0, Math.floor(Number(value.lifetimeUsedSeconds) || 0)),
        updatedAt: value.updatedAt || new Date().toISOString()
    };
}

export function readLocalArcadeTime() {
    try {
        return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch (_error) {
        return normalize();
    }
}

export function writeLocalArcadeTime(value) {
    const normalized = normalize({ ...value, updatedAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
}

export function refreshLocalFormativeWindow() {
    const wallet = readLocalArcadeTime();
    const secondsAdded = Math.max(0, FORMATIVE_PASS_SECONDS - wallet.availableSeconds);
    wallet.availableSeconds = FORMATIVE_PASS_SECONDS;
    wallet.lifetimeEarnedSeconds += secondsAdded;
    return writeLocalArcadeTime(wallet);
}

export function consumeLocalArcadeMinute() {
    const wallet = readLocalArcadeTime();
    if (wallet.availableSeconds < 60) return null;
    wallet.availableSeconds -= 60;
    wallet.lifetimeUsedSeconds += 60;
    return writeLocalArcadeTime(wallet);
}

function sessionKey(studentId) {
    return `${SESSION_STORAGE_PREFIX}${String(studentId || 'local-dev')}`;
}

export function readLocalArcadeSession(studentId) {
    try {
        const saved = JSON.parse(localStorage.getItem(sessionKey(studentId)) || '{}');
        return {
            remainingSeconds: Math.min(600, Math.max(0, Math.floor(Number(saved.remainingSeconds) || 0))),
            gameId: String(saved.gameId || '').slice(0, 120),
            updatedAt: saved.updatedAt || ''
        };
    } catch (_error) {
        return { remainingSeconds: 0, gameId: '', updatedAt: '' };
    }
}

export function writeLocalArcadeSession(studentId, value = {}) {
    const session = {
        remainingSeconds: Math.min(600, Math.max(0, Math.floor(Number(value.remainingSeconds) || 0))),
        gameId: String(value.gameId || '').slice(0, 120),
        updatedAt: new Date().toISOString()
    };
    try {
        if (session.remainingSeconds <= 0) {
            localStorage.removeItem(sessionKey(studentId));
            return session;
        }
        localStorage.setItem(sessionKey(studentId), JSON.stringify(session));
    } catch (_error) {
        // The in-memory timer continues even if browser storage is unavailable.
    }
    return session;
}

export { FORMATIVE_PASS_SECONDS };
