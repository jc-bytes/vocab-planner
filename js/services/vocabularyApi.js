import { collection, getCurrentSchoolYear, getDocs } from '../supabaseService.js';

export { getCurrentSchoolYear };

export const SCHOOL_CALENDAR_SETTINGS_KEY = 'schoolCalendar';
export const SCHOOL_CALENDAR_LOCAL_KEY = 'dev_school_calendar';

const MANIFEST_CACHE_KEY = 'vocab_manifest_cache_v1';
const MANIFEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const VOCAB_FILE_CACHE_KEY = 'vocab_file_cache_v1';
const VOCAB_FILE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const vocabFileRequests = new Map();
const MONTH_KEYS = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december'
];

function parseDateOnly(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }
    return date;
}

function toDateOnly(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const date = parseDateOnly(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

export function getMonthKeyFromDate(value) {
    const date = parseDateOnly(value);
    return date ? MONTH_KEYS[date.getUTCMonth()] : '';
}

export function getDefaultSchoolCalendar(date = new Date()) {
    return {
        schoolYear: getCurrentSchoolYear(date),
        trimesters: {
            IT: { startDate: '', endDate: '' },
            IIT: { startDate: '', endDate: '' },
            IIIT: { startDate: '', endDate: '' }
        }
    };
}

export function normalizeSchoolCalendar(calendar, fallbackDate = new Date()) {
    const fallback = getDefaultSchoolCalendar(fallbackDate);
    const source = calendar && typeof calendar === 'object' ? calendar : {};

    return {
        schoolYear: String(source.schoolYear || fallback.schoolYear),
        trimesters: {
            IT: {
                startDate: toDateOnly(source.trimesters?.IT?.startDate),
                endDate: toDateOnly(source.trimesters?.IT?.endDate)
            },
            IIT: {
                startDate: toDateOnly(source.trimesters?.IIT?.startDate),
                endDate: toDateOnly(source.trimesters?.IIT?.endDate)
            },
            IIIT: {
                startDate: toDateOnly(source.trimesters?.IIIT?.startDate),
                endDate: toDateOnly(source.trimesters?.IIIT?.endDate)
            }
        }
    };
}

export function calculateVocabularyPlacement(assignedDate, calendar) {
    const date = parseDateOnly(assignedDate);
    if (!date) return null;

    const normalizedCalendar = normalizeSchoolCalendar(calendar, date);
    const month = getMonthKeyFromDate(assignedDate);

    for (const trimester of ['IT', 'IIT', 'IIIT']) {
        const range = normalizedCalendar.trimesters[trimester];
        const startDate = parseDateOnly(range.startDate);
        const endDate = parseDateOnly(range.endDate);

        if (!startDate || !endDate || date < startDate || date > endDate) continue;

        const daysSinceStart = Math.floor((date.getTime() - startDate.getTime()) / 86400000);
        return {
            assignedDate: toDateOnly(assignedDate),
            trimester,
            month,
            week: Math.floor(daysSinceStart / 7) + 1
        };
    }

    return {
        assignedDate: toDateOnly(assignedDate),
        month,
        trimester: '',
        week: ''
    };
}

export function getCurrentTrimesterFromCalendar(date = new Date(), calendar = null) {
    const dateOnly = toDateOnly(date);
    const placement = calculateVocabularyPlacement(dateOnly, calendar);
    return placement?.trimester || '';
}

function readManifestCache() {
    try {
        const raw = localStorage.getItem(MANIFEST_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.manifest || !parsed?.cachedAt) return null;
        return parsed;
    } catch (error) {
        console.warn('Could not read vocabulary manifest cache:', error);
        return null;
    }
}

function writeManifestCache(manifest) {
    try {
        localStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify({
            manifest,
            cachedAt: Date.now()
        }));
    } catch (error) {
        console.warn('Could not write vocabulary manifest cache:', error);
    }
}

function isManifestCacheFresh(cacheEntry) {
    return cacheEntry && Date.now() - Number(cacheEntry.cachedAt) < MANIFEST_CACHE_TTL_MS;
}

async function fetchManifestFromNetwork() {
    return fetchJsonFromNetwork('vocabularies/manifest.json');
}

async function fetchJsonFromNetwork(path) {
    const url = new URL(path, window.location.href);
    url.searchParams.set('_', Date.now().toString());
    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    return response.json();
}

export function invalidateManifestCache() {
    try {
        localStorage.removeItem(MANIFEST_CACHE_KEY);
    } catch (error) {
        console.warn('Could not clear vocabulary manifest cache:', error);
    }
}

export async function loadManifest({ fresh = false } = {}) {
    const cached = readManifestCache();

    if (!fresh && isManifestCacheFresh(cached)) {
        return cached.manifest;
    }

    try {
        const manifest = await fetchManifestFromNetwork();
        if (manifest) {
            writeManifestCache(manifest);
        }
        return manifest;
    } catch (error) {
        console.warn('Could not fetch vocabulary manifest from network:', error);
        if (cached?.manifest) {
            return cached.manifest;
        }
        return null;
    }
}

export async function loadManifestVocabularyList(options = {}) {
    const manifest = await loadManifest(options);
    return Array.isArray(manifest?.vocabularies) ? manifest.vocabularies : [];
}

function readVocabFileCache() {
    try {
        const raw = localStorage.getItem(VOCAB_FILE_CACHE_KEY);
        if (!raw) return { entries: {} };
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { entries: {} };
        return {
            entries: parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {}
        };
    } catch (error) {
        console.warn('Could not read vocabulary file cache:', error);
        return { entries: {} };
    }
}

function writeVocabFileCache(cache) {
    try {
        localStorage.setItem(VOCAB_FILE_CACHE_KEY, JSON.stringify({
            entries: cache.entries || {}
        }));
    } catch (error) {
        console.warn('Could not write vocabulary file cache:', error);
    }
}

function getCachedVocabFile(path) {
    const cache = readVocabFileCache();
    const entry = cache.entries?.[path];
    return entry?.data && entry?.cachedAt ? entry : null;
}

function isVocabFileCacheFresh(entry) {
    return entry && Date.now() - Number(entry.cachedAt) < VOCAB_FILE_CACHE_TTL_MS;
}

function writeCachedVocabFile(path, data) {
    const cache = readVocabFileCache();
    cache.entries[path] = {
        data,
        cachedAt: Date.now()
    };
    writeVocabFileCache(cache);
}

export function invalidateVocabularyFileCache(path) {
    try {
        if (!path) {
            localStorage.removeItem(VOCAB_FILE_CACHE_KEY);
            return;
        }

        const cache = readVocabFileCache();
        delete cache.entries[path];
        writeVocabFileCache(cache);
    } catch (error) {
        console.warn('Could not clear vocabulary file cache:', error);
    }
}

export async function loadVocabularyFile(path, { fresh = false, silent = false } = {}) {
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) return null;

    const cached = getCachedVocabFile(normalizedPath);
    if (!fresh && isVocabFileCacheFresh(cached)) {
        return cached.data;
    }

    const requestKey = `${normalizedPath}|${fresh ? 'fresh' : 'normal'}`;
    if (vocabFileRequests.has(requestKey)) {
        return vocabFileRequests.get(requestKey);
    }

    const request = fetchJsonFromNetwork(normalizedPath)
        .then(data => {
            if (data) {
                writeCachedVocabFile(normalizedPath, data);
            }
            return data;
        })
        .catch(error => {
            if (!silent) {
                console.warn(`Could not fetch vocabulary file ${normalizedPath}:`, error);
            }
            if (cached?.data) {
                return cached.data;
            }
            return null;
        })
        .finally(() => {
            vocabFileRequests.delete(requestKey);
        });

    vocabFileRequests.set(requestKey, request);
    return request;
}

export function preloadVocabularyFile(path) {
    return loadVocabularyFile(path, { silent: true }).catch(() => null);
}

export async function loadCloudVocabularyList(api) {
    await api.init();
    const db = api.getDatabase();
    const snapshot = await getDocs(collection(db, 'vocabularies'));
    return snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        __source: 'cloud'
    }));
}
