import {
    ARCADE_MINUTE_SECONDS,
    FORMATIVE_PASS_SECONDS
} from './studentArcadePolicy.js';

const STORAGE_KEY = 'student_arcade_time_v1';

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
    if (wallet.availableSeconds < ARCADE_MINUTE_SECONDS) return null;
    wallet.availableSeconds -= ARCADE_MINUTE_SECONDS;
    wallet.lifetimeUsedSeconds += ARCADE_MINUTE_SECONDS;
    return writeLocalArcadeTime(wallet);
}
