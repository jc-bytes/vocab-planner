import { getCurrentSchoolYear } from './supabaseValues.js';
import { subjectsRepository } from './subjectsRepository.js';
import { vocabularyRepository } from './vocabularyRepository.js';

export { getCurrentSchoolYear };

export const SCHOOL_CALENDAR_SETTINGS_KEY = 'schoolCalendar';
export const SCHOOL_CALENDAR_LOCAL_KEY = 'dev_school_calendar';
export const DEFAULT_SUBJECT_SLUG = 'technology';
export const SUBJECTS_LOCAL_KEY = 'dev_subjects';
export const DEFAULT_SUBJECTS = Object.freeze([
    { slug: 'technology', name: 'Technology', color: '#2563eb', sortOrder: 10, active: true },
    { slug: 'science', name: 'Science', color: '#16a34a', sortOrder: 20, active: true }
]);

const MANIFEST_CACHE_KEY = 'vocab_manifest_cache_v4';
const MANIFEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const VOCAB_FILE_CACHE_KEY = 'vocab_file_cache_v2';
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
export const SCHOOL_WEEKDAYS = Object.freeze([
    { value: 1, key: 'monday', shortLabel: 'Mon' },
    { value: 2, key: 'tuesday', shortLabel: 'Tue' },
    { value: 3, key: 'wednesday', shortLabel: 'Wed' },
    { value: 4, key: 'thursday', shortLabel: 'Thu' },
    { value: 5, key: 'friday', shortLabel: 'Fri' }
]);
const SUBJECT_COLORS = ['#2563eb', '#16a34a', '#db2777', '#f59e0b', '#7c3aed', '#0891b2'];
const DEFAULT_SCHOOL_CALENDARS = Object.freeze({
    '2026': Object.freeze({
        trimesters: Object.freeze({
            IT: Object.freeze({ startDate: '2026-03-02', endDate: '2026-05-29', weekCount: 13 }),
            IIT: Object.freeze({ startDate: '2026-06-08', endDate: '2026-09-04', weekCount: 13 }),
            IIIT: Object.freeze({ startDate: '2026-09-14', endDate: '2026-12-11', weekCount: 13 })
        })
    })
});

export function normalizeSubjectSlug(value, fallback = DEFAULT_SUBJECT_SLUG) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function titleFromSlug(slug) {
    return String(slug || DEFAULT_SUBJECT_SLUG)
        .split('-')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeColor(value, fallback = '#2563eb') {
    return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
}

export function normalizeSubject(subject = {}, index = 0) {
    const rawSlug = subject.slug || subject.id || subject.subjectSlug || subject.name;
    const slug = normalizeSubjectSlug(rawSlug);
    const defaultSubject = DEFAULT_SUBJECTS.find(item => item.slug === slug);
    return {
        slug,
        id: slug,
        name: String(subject.name || defaultSubject?.name || titleFromSlug(slug)).trim(),
        color: normalizeColor(subject.color, defaultSubject?.color || SUBJECT_COLORS[index % SUBJECT_COLORS.length]),
        sortOrder: Number.isFinite(Number(subject.sortOrder ?? subject.sort_order))
            ? Number(subject.sortOrder ?? subject.sort_order)
            : defaultSubject?.sortOrder ?? ((index + 1) * 10),
        active: subject.active !== false
    };
}

export function normalizeSubjects(subjects = []) {
    const bySlug = new Map(DEFAULT_SUBJECTS.map((subject, index) => [
        subject.slug,
        normalizeSubject(subject, index)
    ]));

    (Array.isArray(subjects) ? subjects : []).forEach((subject, index) => {
        const normalized = normalizeSubject(subject, index);
        bySlug.set(normalized.slug, normalized);
    });

    return Array.from(bySlug.values()).sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
    });
}

export function getVocabSubjectSlug(vocab = {}) {
    return normalizeSubjectSlug(vocab.subjectSlug || vocab.subject_slug || vocab.subject || vocab.course);
}

export function withDefaultSubject(vocab = {}) {
    return {
        ...vocab,
        subjectSlug: getVocabSubjectSlug(vocab)
    };
}

export function getSubjectBySlug(subjects = [], slug = DEFAULT_SUBJECT_SLUG) {
    const normalizedSlug = normalizeSubjectSlug(slug);
    return normalizeSubjects(subjects).find(subject => subject.slug === normalizedSlug)
        || normalizeSubject({ slug: normalizedSlug });
}

export async function loadSubjects(api = null) {
    if (!api) return normalizeSubjects();

    try {
        await api.init();
        return normalizeSubjects(await subjectsRepository.list());
    } catch (error) {
        console.warn('Could not load subjects, using defaults:', error);
        return normalizeSubjects();
    }
}

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

function addDaysDateOnly(date, days) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const result = new Date(date.getTime());
    result.setUTCDate(result.getUTCDate() + Number(days || 0));
    return result.toISOString().slice(0, 10);
}

function normalizeWeekCount(value) {
    const weekCount = Number.parseInt(String(value || ''), 10);
    return Number.isInteger(weekCount) && weekCount > 0 ? weekCount : '';
}

export function getMonthKeyFromDate(value) {
    const date = parseDateOnly(value);
    return date ? MONTH_KEYS[date.getUTCMonth()] : '';
}

export function calculateCalendarEndDateFromWeekCount(startDate, weekCount) {
    const start = parseDateOnly(startDate);
    const weeks = normalizeWeekCount(weekCount);
    if (!start || !weeks) return '';
    return addDaysDateOnly(start, ((weeks - 1) * 7) + 4);
}

export function calculateCalendarWeekCount(startDate, endDate) {
    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end || end < start) return '';

    const daysSinceStart = Math.floor((end.getTime() - start.getTime()) / 86400000);
    return Math.floor(daysSinceStart / 7) + 1;
}

export function calculateCalendarWeekRange(startDate, weekNumber) {
    const start = parseDateOnly(startDate);
    const week = normalizeWeekCount(weekNumber);
    if (!start || !week) return { startDate: '', endDate: '' };

    const weekStartDate = addDaysDateOnly(start, (week - 1) * 7);
    const weekStart = parseDateOnly(weekStartDate);
    return {
        startDate: weekStartDate,
        endDate: addDaysDateOnly(weekStart, 4)
    };
}

export function getDefaultSchoolCalendar(date = new Date()) {
    const schoolYear = getCurrentSchoolYear(date);
    const defaults = DEFAULT_SCHOOL_CALENDARS[schoolYear]?.trimesters || {};

    return {
        schoolYear,
        trimesters: {
            IT: { startDate: defaults.IT?.startDate || '', endDate: defaults.IT?.endDate || '', weekCount: defaults.IT?.weekCount || '' },
            IIT: { startDate: defaults.IIT?.startDate || '', endDate: defaults.IIT?.endDate || '', weekCount: defaults.IIT?.weekCount || '' },
            IIIT: { startDate: defaults.IIIT?.startDate || '', endDate: defaults.IIIT?.endDate || '', weekCount: defaults.IIIT?.weekCount || '' }
        }
    };
}

function normalizeTrimesterRange(sourceRange = {}, fallbackRange = {}) {
    const startDate = toDateOnly(sourceRange.startDate) || fallbackRange.startDate || '';
    const sourceWeekCount = normalizeWeekCount(sourceRange.weekCount || sourceRange.weeks);
    const endDate = toDateOnly(sourceRange.endDate)
        || calculateCalendarEndDateFromWeekCount(startDate, sourceWeekCount)
        || fallbackRange.endDate
        || '';
    const weekCount = sourceWeekCount
        || calculateCalendarWeekCount(startDate, endDate)
        || fallbackRange.weekCount
        || '';

    return { startDate, endDate, weekCount };
}

function normalizeClassWeekday(value) {
    const numeric = Number.parseInt(String(value), 10);
    if (numeric >= 1 && numeric <= 5) return numeric;

    const normalized = String(value || '').trim().toLowerCase();
    const aliases = {
        mon: 1, monday: 1,
        tue: 2, tues: 2, tuesday: 2,
        wed: 3, wednesday: 3,
        thu: 4, thur: 4, thurs: 4, thursday: 4,
        fri: 5, friday: 5
    };
    return aliases[normalized] || null;
}

export function normalizeClassSchedules(classSchedules = []) {
    const byClass = new Map();

    (Array.isArray(classSchedules) ? classSchedules : []).forEach(schedule => {
        const grade = String(schedule?.grade ?? schedule?.gradeLevel ?? '').match(/\d+/)?.[0] || '';
        const section = String(schedule?.section ?? schedule?.group ?? '').trim().toUpperCase();
        const weekdays = [...new Set((Array.isArray(schedule?.weekdays) ? schedule.weekdays : [])
            .map(normalizeClassWeekday)
            .filter(Boolean))].sort((a, b) => a - b);

        if (!grade || !section || weekdays.length === 0) return;
        byClass.set(`${grade}:${section}`, { grade, section, weekdays });
    });

    return Array.from(byClass.values()).sort((a, b) => (
        Number(a.grade) - Number(b.grade) || a.section.localeCompare(b.section)
    ));
}

export function getStudentClassSchedule(calendar, profile = {}) {
    const grade = String(profile.grade ?? profile.gradeLevel ?? profile.grade_level ?? '').match(/\d+/)?.[0] || '';
    const section = String(profile.group ?? profile.section ?? profile.sectionLetter ?? profile.section_letter ?? '')
        .trim()
        .toUpperCase();
    if (!grade || !section) return null;

    return normalizeClassSchedules(calendar?.classSchedules)
        .find(schedule => schedule.grade === grade && schedule.section === section) || null;
}

export function calculateClassReleaseDate(assignedDate, calendar, profile = {}) {
    const assigned = parseDateOnly(assignedDate);
    if (!assigned) return '';

    const schedule = getStudentClassSchedule(calendar, profile);
    if (!schedule) return toDateOnly(assignedDate);

    for (let offset = 0; offset < 7; offset += 1) {
        const candidate = new Date(assigned.getTime());
        candidate.setUTCDate(candidate.getUTCDate() + offset);
        if (schedule.weekdays.includes(candidate.getUTCDay())) {
            return candidate.toISOString().slice(0, 10);
        }
    }

    return toDateOnly(assignedDate);
}

export function normalizeSchoolCalendar(calendar, fallbackDate = new Date()) {
    const source = calendar && typeof calendar === 'object' ? calendar : {};
    const schoolYear = String(source.schoolYear || getCurrentSchoolYear(fallbackDate));
    const fallbackYear = /^\d{4}$/.test(schoolYear)
        ? Number(schoolYear)
        : Number(getCurrentSchoolYear(fallbackDate));
    const fallback = getDefaultSchoolCalendar(new Date(fallbackYear, 0, 1, 12));
    const sourceTrimesters = source.trimesters && typeof source.trimesters === 'object'
        ? source.trimesters
        : {};

    return {
        schoolYear,
        classSchedules: normalizeClassSchedules(source.classSchedules || source.class_schedules),
        trimesters: {
            IT: normalizeTrimesterRange(sourceTrimesters.IT, fallback.trimesters.IT),
            IIT: normalizeTrimesterRange(sourceTrimesters.IIT, fallback.trimesters.IIT),
            IIIT: normalizeTrimesterRange(sourceTrimesters.IIIT, fallback.trimesters.IIIT)
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

async function fetchManifestFromNetwork(options = {}) {
    return fetchJsonFromNetwork('vocabularies/manifest.json', options);
}

async function fetchJsonFromNetwork(path, { fresh = false } = {}) {
    const url = new URL(path, window.location.href);
    const response = await fetch(url.toString(), {
        cache: fresh ? 'reload' : 'default'
    });
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
        const manifest = await fetchManifestFromNetwork({ fresh });
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
    return Array.isArray(manifest?.vocabularies) ? manifest.vocabularies.map(withDefaultSubject) : [];
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
        return withDefaultSubject(cached.data);
    }

    const requestKey = `${normalizedPath}|${fresh ? 'fresh' : 'normal'}`;
    if (vocabFileRequests.has(requestKey)) {
        return vocabFileRequests.get(requestKey);
    }

    const request = fetchJsonFromNetwork(normalizedPath, { fresh })
        .then(data => {
            if (data) {
                writeCachedVocabFile(normalizedPath, data);
            }
            return data ? withDefaultSubject(data) : data;
        })
        .catch(error => {
            if (!silent) {
                console.warn(`Could not fetch vocabulary file ${normalizedPath}:`, error);
            }
            if (cached?.data) {
                return withDefaultSubject(cached.data);
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
    return (await vocabularyRepository.list()).map(vocabulary => ({
        ...vocabulary,
        subjectSlug: getVocabSubjectSlug(vocabulary),
        __source: 'cloud'
    }));
}
