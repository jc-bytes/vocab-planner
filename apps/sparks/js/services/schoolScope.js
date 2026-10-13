import { schoolContext } from './schoolContext.js';

// Capture this before any await. A delayed save must retain its original school.
export function requireSchoolId() {
    const id = schoolContext.getSchoolId();
    if (!id) throw new Error('Choose a school before continuing.');
    return id;
}

export function schoolSessionKey(accountId) {
    return `${accountId || 'signed-out'}:${schoolContext.getSchoolId() || 'no-school'}`;
}

export function canOpenSchoolSection(section) {
    if (section === 'administration') return true;
    if (section === 'settings') return schoolContext.hasRole('school_admin');
    return schoolContext.hasRole('teacher') || schoolContext.hasRole('school_admin');
}
