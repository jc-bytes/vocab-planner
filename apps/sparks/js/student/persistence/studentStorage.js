const STUDENT_STORAGE_PREFIX = 'student:v2';
const STUDENT_STORAGE_QUARANTINE_PREFIX = 'student:quarantine:v1';
const LOCAL_DEVELOPMENT_OWNER = 'local-dev';

let activeStudentOwnerId = LOCAL_DEVELOPMENT_OWNER;

export function normalizeStudentOwnerId(value) {
    const candidate = typeof value === 'object'
        ? value?.uid || value?.id || ''
        : value;
    return String(candidate || '').trim();
}

export function setActiveStudentStorageOwner(value) {
    activeStudentOwnerId = normalizeStudentOwnerId(value) || LOCAL_DEVELOPMENT_OWNER;
    return activeStudentOwnerId;
}

export function getActiveStudentStorageOwner() {
    return activeStudentOwnerId;
}

export function isActiveStudentStorageOwner(value) {
    const ownerUserId = normalizeStudentOwnerId(value);
    return Boolean(ownerUserId && ownerUserId === activeStudentOwnerId);
}

function encodeStoragePart(value) {
    return encodeURIComponent(String(value || '').trim());
}

export function getStudentStorageKey(baseKey, owner = activeStudentOwnerId) {
    const ownerUserId = normalizeStudentOwnerId(owner) || LOCAL_DEVELOPMENT_OWNER;
    return `${STUDENT_STORAGE_PREFIX}:${encodeStoragePart(ownerUserId)}:${encodeStoragePart(baseKey)}`;
}

export function getStudentProgressStorageKey(owner = activeStudentOwnerId) {
    return getStudentStorageKey('progress', owner);
}

export function getStudentWordHuntStorageKey(vocabName, wordCount, owner = activeStudentOwnerId) {
    return getStudentStorageKey(`word-hunt:${vocabName}:${wordCount}`, owner);
}

export function quarantineLegacyStudentStorageKey(legacyKey, storage = globalThis.localStorage) {
    const key = String(legacyKey || '').trim();
    if (!key || !storage) return false;

    const legacyValue = storage.getItem(key);
    if (legacyValue === null) return false;

    const quarantineKey = `${STUDENT_STORAGE_QUARANTINE_PREFIX}:${encodeStoragePart(key)}`;
    try {
        if (storage.getItem(quarantineKey) === null) {
            storage.setItem(quarantineKey, legacyValue);
        }
        storage.removeItem(key);
        return true;
    } catch (error) {
        console.warn(`Could not quarantine legacy student storage key ${key}:`, error);
        return false;
    }
}

function quarantineLegacyKeys(legacyKeys = [], storage = globalThis.localStorage) {
    for (const legacyKey of legacyKeys) {
        quarantineLegacyStudentStorageKey(legacyKey, storage);
    }
}

export function readStudentValue(baseKey, options = {}) {
    const storage = options.storage || globalThis.localStorage;
    if (!storage) return null;
    quarantineLegacyKeys(options.legacyKeys, storage);
    return storage.getItem(getStudentStorageKey(baseKey, options.owner));
}

export function writeStudentValue(baseKey, value, options = {}) {
    const storage = options.storage || globalThis.localStorage;
    if (!storage) return;
    storage.setItem(getStudentStorageKey(baseKey, options.owner), String(value));
}

export function removeStudentValue(baseKey, options = {}) {
    const storage = options.storage || globalThis.localStorage;
    if (!storage) return;
    storage.removeItem(getStudentStorageKey(baseKey, options.owner));
    quarantineLegacyKeys(options.legacyKeys, storage);
}

export function readStudentJson(baseKey, fallback = null, options = {}) {
    const rawValue = readStudentValue(baseKey, options);
    if (rawValue === null) return fallback;
    try {
        return JSON.parse(rawValue);
    } catch (error) {
        console.warn(`Could not parse student storage key ${baseKey}:`, error);
        return fallback;
    }
}

export function writeStudentJson(baseKey, value, options = {}) {
    writeStudentValue(baseKey, JSON.stringify(value), options);
}

export function getStudentActivityStorageKey(legacyKey) {
    return `activity:${String(legacyKey || '').trim()}`;
}

export function readStudentActivityValue(legacyKey, options = {}) {
    return readStudentValue(getStudentActivityStorageKey(legacyKey), {
        ...options,
        legacyKeys: [legacyKey, ...(options.legacyKeys || [])]
    });
}

export function writeStudentActivityValue(legacyKey, value, options = {}) {
    return writeStudentValue(getStudentActivityStorageKey(legacyKey), value, options);
}

export function removeStudentActivityValue(legacyKey, options = {}) {
    return removeStudentValue(getStudentActivityStorageKey(legacyKey), {
        ...options,
        legacyKeys: [legacyKey, ...(options.legacyKeys || [])]
    });
}

export { LOCAL_DEVELOPMENT_OWNER };
