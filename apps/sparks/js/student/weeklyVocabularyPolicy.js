// Versioned rules apply only to the new weekly vocabulary catalog.
export function weeklySettings(vocab) {
    const settings = vocab?.activitySettings || {};
    return settings.weeklyPoolVersion === 1 ? settings : null;
}

export function studentSection(profile = {}) {
    return String(profile.group || profile.section || profile.section_letter || '').trim().toUpperCase().replace(/^\d+/, '');
}

export function weeklyVocabularyVisible(vocab, profile = {}, date = null) {
    const settings = vocab?.activitySettings || {};
    if (settings.retiredWeeklySet) return false;
    if (!weeklySettings(vocab)) return true;
    const section = studentSection(profile);
    if (settings.sections?.length && !settings.sections.includes(section)) return false;
    if (date) {
        const start = settings.releaseDates?.[section] || vocab.assignedDate;
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (start && start > day) return false;
    }
    return true;
}

export function isVocabularyProjectBreak(date = new Date()) {
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return day >= '2026-10-12' && day <= '2026-10-23';
}

export function weeklyWordPlayable(activityType, word = {}, vocab, fallback) {
    if (weeklySettings(vocab) && activityType === 'word-search') {
        const normalized = String(word.word || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return normalized.length >= 2 && normalized.length <= 15;
    }
    return fallback?.(word) || false;
}

export function activityHasPlayableRound(activityType, vocab, count) {
    if (vocab?.activitySettings?.retiredWeeklySet) return false;
    const minimum = weeklySettings(vocab) && ['matching', 'quiz', 'word-search', 'crossword', 'speed-match', 'fill-in-blank'].includes(activityType) ? 4 : 1;
    return count >= minimum;
}
