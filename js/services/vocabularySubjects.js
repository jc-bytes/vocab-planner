import { subjectsRepository } from './subjectsRepository.js';

export const DEFAULT_SUBJECT_SLUG = 'technology';

export const SUBJECTS_LOCAL_KEY = 'dev_subjects';

export const DEFAULT_SUBJECTS = Object.freeze([
    { slug: 'technology', name: 'Technology', color: '#2563eb', sortOrder: 10, active: true },
    { slug: 'science', name: 'Science', color: '#16a34a', sortOrder: 20, active: true }
]);

const SUBJECT_COLORS = ['#2563eb', '#16a34a', '#db2777', '#f59e0b', '#7c3aed', '#0891b2'];

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

export async function loadSubjects(api = null, options = {}) {
    if (!api) return normalizeSubjects();

    try {
        await api.init();
        return normalizeSubjects(await subjectsRepository.list(options));
    } catch (error) {
        console.warn('Could not load subjects, using defaults:', error);
        return normalizeSubjects();
    }
}

