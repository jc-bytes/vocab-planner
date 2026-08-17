import {
    DEFAULT_SUBJECT_SLUG,
    normalizeSubjectSlug
} from '../services/vocabularyApi.js';

export const WORD_HUNT_REVIEW_STORAGE_KEY = 'teacher_word_hunt_review_notes';
export const WORD_HUNT_REVIEW_VIEW_MODE_KEY = 'teacher_word_hunt_review_view_modes';

export function getWordHuntReviewStudentName(student = {}) {
    const profile = student.studentProfile || {};
    if (profile.firstName && profile.lastName) return `${profile.firstName} ${profile.lastName}`;
    return profile.name || student.email || 'Unknown student';
}

export function getWordHuntReviewUnitLabel(unitId = '') {
    return String(unitId || 'Vocabulary').replace(/_/g, ' ');
}

export function getWordHuntReviewSubjectSlug(unitId = '', subjects = []) {
    const parts = String(unitId || '').split(':');
    if (parts.length <= 1) return DEFAULT_SUBJECT_SLUG;
    const candidate = normalizeSubjectSlug(parts[0], '');
    return subjects.some(subject => subject.slug === candidate) ? candidate : DEFAULT_SUBJECT_SLUG;
}
